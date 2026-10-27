"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_VIEWER_ID, DEMO_FAMILY, DEMO_MEMBERS, MOCK_SIGNAL_LINES } from "@/lib/family";
import { normalizeLang, type SupportedLang } from "@/lib/i18n";
import type { Member } from "@/lib/schemas";

interface ViewerState {
  viewer: Member;
  members: Member[];
  lang: SupportedLang;
  signalLine: string;
  setViewerId: (id: string) => void;
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
  const [viewerId, setViewerId] = useState<string>(DEFAULT_VIEWER_ID);

  const refreshMembers = useCallback(async () => {
    try {
      const fresh = await fetchMembers();
      if (fresh.length > 0) setMembers(fresh);
    } catch {
      // Offline or server hiccup: keep the seeded demo members.
    }
  }, []);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  const value = useMemo<ViewerState>(() => {
    const viewer = members.find((m) => m.id === viewerId) ?? fallbackViewer();
    return {
      viewer,
      members,
      lang: normalizeLang(viewer.lang),
      signalLine: MOCK_SIGNAL_LINES[viewer.id] ?? MOCK_SIGNAL_LINES[DEFAULT_VIEWER_ID],
      setViewerId,
      refreshMembers,
    };
  }, [members, viewerId, refreshMembers]);

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): ViewerState {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used inside ViewerProvider");
  return ctx;
}

export { DEMO_FAMILY };
