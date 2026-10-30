"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { talkTarget } from "@/lib/households";
import { callName, memberPhoto, peopleByRecency } from "@/lib/people";
import { useFamilyCards } from "@/lib/use-family";
import { useLargeText } from "@/lib/use-large-text";
import { roomsFor, type Room } from "@/lib/menu";
import dynamic from "next/dynamic";
import type { AddTab, ReplyContribution } from "./add-sheet";

import { PlayerProvider, usePlayer } from "./player";
import { Avatar, Icon, type IconName } from "./ui/kit";
import { ViewerProvider, useViewer } from "./viewer";
import { PeoplePicker } from "./people-picker";

// The composer (mic, EXIF, media processing) loads only when first opened.
const AddSheet = dynamic(() => import("./add-sheet").then((m) => m.AddSheet), { ssr: false });

interface ShellState {
  addOpen: boolean;
  addTab: AddTab;
  replyTo: ReplyContribution | null;
  /** Member a voice note is addressed to; null = whole family. */
  /** Preselected recipients: one person, a household, or none (everyone). */
  addressee: string[] | null;
  openAdd: (tab?: AddTab, replyTo?: ReplyContribution | null, addressee?: string | string[] | null) => void;
  closeAdd: () => void;
  refreshKey: number;
  bumpRefresh: () => void;
  chromeHidden: boolean;
  setChromeHidden: (v: boolean) => void;
  /** Open a room's sheet ("all" = every room). */
  openRoom: (room: Room["id"] | "all") => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside Shell");
  return ctx;
}


function RoomsSheet({ room, onClose }: { room: Room["id"] | "all" | null; onClose: () => void }) {
  const { viewer, members } = useViewer();
  const parent = viewer.role === "elder";
  const names = members
    .filter((m) => m.role === "elder" && m.id !== viewer.id)
    .slice(0, 2)
    .map((m) => callName(m))
    .join(" & ");
  const all = roomsFor(parent, names);
  const rooms = room === "all" ? all : all.filter((r) => r.id === room);
  const open = room !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={room === "all" ? "Rooms" : rooms[0]?.title}>
          <m.button type="button" aria-label="Close" className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <m.nav
            className="frost relative w-full max-w-[480px] overflow-y-auto rounded-t-[32px] px-4 pt-3"
            style={{ maxHeight: "88vh", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/15" aria-hidden="true" />
            {room === "all" && (
              <Link href="/settings" onClick={onClose} className="press mb-4 flex items-center gap-3 rounded-[22px] bg-white/90 px-3.5 py-3 text-ink no-underline ring-1 ring-black/[.05]">
                <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold leading-tight">{viewer.firstName}</span>
                  <span className="block text-[13px] text-ink-soft">Settings, your window, language, privacy</span>
                </span>
                <Icon name="settings" size={20} className="text-ink-soft" />
              </Link>
            )}
            {rooms.map((g) => (
              <section key={g.id} aria-label={g.title} className="mb-4">
                <div className="mb-2 flex items-center gap-3 px-2">
                  <span className="grid h-9 w-9 place-items-center rounded-[12px]" style={{ background: g.tone[0], color: g.tone[1] }}>
                    <Icon name={g.icon as IconName} size={18} />
                  </span>
                  <h2 className="m-0 text-[19px]">{g.title}</h2>
                </div>
                <ul className="m-0 list-none overflow-hidden rounded-[22px] bg-white/90 p-0 ring-1 ring-black/[.05]">
                  {g.items.map((r, i) => (
                    <li key={r.href + r.title} className={i ? "border-t border-[var(--line)]" : ""}>
                      <Link href={r.href} onClick={onClose} className="press flex items-center gap-3.5 px-3.5 py-3 text-ink no-underline hover:bg-black/[.03]">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: g.tone[0], color: g.tone[1] }}>
                          <Icon name={r.icon as IconName} size={19} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] font-semibold leading-tight">{r.title}</span>
                          <span className="block truncate text-[13px] text-ink-soft">{r.note}</span>
                        </span>
                        <Icon name="chevron" size={16} className="text-ink-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </m.nav>
        </div>
      )}
    </AnimatePresence>
  );
}

// The dock: a voice note (to anyone; it says who is waiting for your reply)
// and a photo. The rooms live on the Kutumb page and behind your profile photo.
function Dock() {
  const { openAdd, refreshKey, chromeHidden } = useShell();
  const { viewer, members, relationships } = useViewer();
  const { cards } = useFamilyCards(refreshKey);
  const { current, open: playerOpen } = usePlayer();
  const pathname = usePathname();
  const [picking, setPicking] = useState(false);

  const pagePerson = pathname.startsWith("/people/") ? members.find((mm) => mm.id === pathname.split("/")[2]) : undefined;
  // Who sent you a voice you haven't answered: shown in the picker, never assumed.
  const waiting = useMemo(() => {
    const t = talkTarget(viewer, members, relationships, cards ?? []);
    return new Set(t?.reason === "reply" ? t.home.members.map((m) => m.id) : []);
  }, [viewer, members, relationships, cards]);
  const others = useMemo(() => peopleByRecency(viewer.id, members, cards ?? []).sort((a, b) => Number(waiting.has(b.id)) - Number(waiting.has(a.id)) || Number(a.role === "child") - Number(b.role === "child")), [viewer.id, members, cards, waiting]);
  const show = (pathname === "/" || pathname.startsWith("/people/")) && !chromeHidden && !playerOpen;
  const voice = () => {
    if (pagePerson && pagePerson.id !== viewer.id) return openAdd("voice", null, [pagePerson.id]);
    if (others.length === 1) return openAdd("voice", null, [others[0].id]);
    setPicking(true);
  };

  return (
    <>
      <AnimatePresence>
        {show && (
          <m.div
            className="fixed inset-x-0 z-40 flex justify-center px-4"
            style={{ bottom: `calc(${current ? 84 : 20}px + env(safe-area-inset-bottom))` }}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          >
            <div className="frost glass-pill flex items-center gap-1 p-1.5">
              {others.length ? (
                <button type="button" onClick={voice} className="press relative flex h-14 items-center gap-2.5 whitespace-nowrap rounded-full bg-black pl-2 pr-6 text-[16px] font-semibold text-white">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-marigold text-black">
                    <Icon name="mic" size={20} strokeWidth={2.2} />
                  </span>
                  {pagePerson && pagePerson.id !== viewer.id ? `Voice note to ${callName(pagePerson)}` : "Voice note"}
                  {waiting.size > 0 && !pagePerson && (
                    <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-[#e8402a] px-1.5 text-[12px] font-bold" aria-label={`${waiting.size} waiting for your reply`}>
                      {waiting.size}
                    </span>
                  )}
                </button>
              ) : (
                <Link href="/settings#invite" className="press flex h-14 items-center gap-2.5 whitespace-nowrap rounded-full bg-black pl-5 pr-6 text-[16px] font-semibold text-white no-underline">
                  <Icon name="plus" size={20} />
                  Invite family
                </Link>
              )}
              <button type="button" onClick={() => openAdd("photos")} aria-label="Share a photo or video" className="press grid h-14 w-14 place-items-center rounded-full">
                <Icon name="camera" size={24} />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <PeoplePicker
        open={picking}
        title="Voice note to"
        people={others}
        everyoneLabel="The whole family"
        status={(p) => (waiting.has(p.id) ? { text: "Waiting for your reply", dot: "#e8402a" } : { text: p.city || "" })}
        onPick={(ids) => {
          setPicking(false);
          openAdd("voice", null, ids.length === others.length ? null : ids);
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

/**
 * Being in Aangan is the "safe & sound" signal the other home sees (green
 * dot). Sent on open and whenever the app comes back to the foreground; the
 * server keeps at most one every 30 minutes and skips people who opted out.
 */
function useHeartbeat(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    const beat = () => {
      if (document.visibilityState === "visible") void fetch("/api/presence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ moment: "here" }) }).catch(() => undefined);
    };
    beat();
    document.addEventListener("visibilitychange", beat);
    return () => document.removeEventListener("visibilitychange", beat);
  }, [on]);
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { viewer, signedIn } = useViewer();
  useHeartbeat(signedIn);
  const [large] = useLargeText(viewer.role === "elder");
  const [addOpen, setAddOpen] = useState(false);
  // Mount the composer on first open, then keep it mounted so its exit animation runs.
  const [sheetLoaded, setSheetLoaded] = useState(false);
  useEffect(() => {
    if (addOpen) setSheetLoaded(true);
  }, [addOpen]);
  const [addTab, setAddTab] = useState<AddTab>("photos");
  const [replyTo, setReplyTo] = useState<ReplyContribution | null>(null);
  const [addressee, setAddressee] = useState<string[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [room, setRoom] = useState<Room["id"] | "all" | null>(null);
  const openRoom = useCallback((r: Room["id"] | "all") => setRoom(r), []);

  const openAdd = useCallback((tab: AddTab = "photos", contribution: ReplyContribution | null = null, to: string | string[] | null = null) => {
    setAddTab(tab);
    setReplyTo(contribution);
    setAddressee(to === null ? null : Array.isArray(to) ? to : [to]);
    setAddOpen(true);
  }, []);
  const closeAdd = useCallback(() => {
    setAddOpen(false);
    setReplyTo(null);
  }, []);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const value = useMemo<ShellState>(
    () => ({ addOpen, addTab, replyTo, addressee, openAdd, closeAdd, refreshKey, bumpRefresh, chromeHidden, setChromeHidden, openRoom }),
    [addOpen, addTab, replyTo, addressee, openAdd, closeAdd, refreshKey, bumpRefresh, chromeHidden, openRoom],
  );

  return (
    <ShellContext.Provider value={value}>
      <PlayerProvider>
        <main
          className="relative mx-auto min-h-full w-full max-w-[480px] px-5"
          style={{ paddingTop: "calc(16px + env(safe-area-inset-top))", paddingBottom: "calc(140px + env(safe-area-inset-bottom))", zoom: large ? 1.12 : undefined }}
        >
          {children}
        </main>
        <Dock />
        <RoomsSheet room={room} onClose={() => setRoom(null)} />
        {sheetLoaded && <AddSheet />}
      </PlayerProvider>
    </ShellContext.Provider>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict={false}>
      <ViewerProvider>
        <ShellInner>{children}</ShellInner>
      </ViewerProvider>
    </LazyMotion>
  );
}
