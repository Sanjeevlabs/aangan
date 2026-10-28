"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_VIEWER_ID, DEMO_FAMILY, DEMO_MEMBERS, signalLineFor } from "@/lib/family";
import { normalizeDisplayLang, type SupportedLang } from "@/lib/i18n";
import type { Member } from "@/lib/schemas";

interface ViewerState {
  /** True once the session and family have loaded (or there is no session). */
  ready: boolean;
  signedIn: boolean;
  viewer: Member;
  members: Member[];
  lang: SupportedLang;
  displayLang: SupportedLang;
  signalLine: string;
  setViewerId: (id: string) => Promise<void>;
  setDisplayLang: (lang: SupportedLang) => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const ViewerContext = createContext<ViewerState | null>(null);

const fallbackViewer = (): Member =>
  DEMO_MEMBERS.find((m) => m.id === DEFAULT_VIEWER_ID) ?? DEMO_MEMBERS[0];

async function fetchMembers(): Promise<Member[]> {
  const res = await fetch("/api/members", { cache: "no-store" });
  if (!res.ok) throw new Error("members-fetch-failed");
  const data = (await res.json()) as { members: Member[] };
  return data.members;
}

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>(DEMO_MEMBERS);
  const [viewerId, setViewerIdState] = useState<string>(DEFAULT_VIEWER_ID);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Viewer switcher keeps the httpOnly session in sync: the server mints a
  // fresh cookie for the same family (no invite code needed twice).
  const setViewerId = useCallback(async (id: string) => {
    try {
      await fetch("/api/session/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: id }),
      });
    } catch {
      // Offline: local state still switches.
    }
    setViewerIdState(id);
  }, []);

  const refreshMembers = useCallback(async () => {
    try {
      const fresh = await fetchMembers();
      if (fresh.length > 0) setMembers(fresh);
    } catch {
      // Offline or server hiccup: keep the seeded demo members.
    }
  }, []);

  // The viewer is whoever the session cookie says, never a hard-coded member.
  const syncSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as { memberId: string };
        const fresh = await fetchMembers().catch(() => [] as Member[]);
        if (fresh.length > 0) setMembers(fresh);
        setViewerIdState(s.memberId);
        setSignedIn(true);
      } else {
        setSignedIn(false);
      }
    } catch {
      setSignedIn(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void syncSession();
    const onAuth = () => void syncSession();
    window.addEventListener("aangan:auth", onAuth);
    return () => window.removeEventListener("aangan:auth", onAuth);
  }, [syncSession]);

  const setDisplayLang = useCallback(
    async (lang: SupportedLang) => {
      const normalized = normalizeDisplayLang(lang);
      setMembers((prev) => prev.map((m) => (m.id === viewerId ? { ...m, displayLang: normalized } : m)));
      try {
        await fetch("/api/members/display-lang", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId: viewerId, displayLang: normalized }),
        });
      } catch {
        // Offline: local state already updated.
      }
      await refreshMembers().catch(() => undefined);
    },
    [viewerId, refreshMembers],
  );

  const value = useMemo<ViewerState>(() => {
    const viewer = members.find((m) => m.id === viewerId) ?? fallbackViewer();
    const displayLang = normalizeDisplayLang(viewer.displayLang ?? viewer.lang);
    return {
      ready,
      signedIn,
      viewer,
      members,
      lang: displayLang,
      displayLang,
      signalLine: signalLineFor(viewer.id, displayLang),
      setViewerId,
      setDisplayLang,
      refreshMembers,
    };
  }, [members, viewerId, ready, signedIn, refreshMembers, setDisplayLang, setViewerId]);

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ViewerState {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used inside ViewerProvider");
  return ctx;
}

export { DEMO_FAMILY };
