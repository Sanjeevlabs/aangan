"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const { viewer } = useViewer();
  const router = useRouter();
  const all = roomsFor(viewer.role === "elder");
  const open = room !== null;
  // One room open at a time; tapping a room shows what's inside it.
  const [expanded, setExpanded] = useState<Room["id"] | null>(null);
  useEffect(() => {
    if (room) setExpanded(room === "all" ? null : room);
  }, [room]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Rooms">
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
            <Link href="/settings" onClick={onClose} className="press mb-3 flex items-center gap-3 rounded-[20px] px-2 py-2 text-ink no-underline">
              <Avatar src={memberPhoto(viewer)} name={viewer.firstName} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold leading-tight">{viewer.firstName}</span>
                <span className="block text-[12.5px] text-ink-soft">Settings · your window · privacy</span>
              </span>
              <Icon name="settings" size={19} className="text-ink-soft" />
            </Link>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {all.map((g) => {
                const isOpen = expanded === g.id;
                return (
                  <li key={g.id} className="overflow-hidden rounded-[20px] bg-white/80 ring-1 ring-black/[.05]">
                    <button
                      type="button"
                      aria-expanded={g.href ? undefined : isOpen}
                      onClick={() => {
                        if (g.href) {
                          onClose();
                          router.push(g.href);
                        } else setExpanded(isOpen ? null : g.id);
                      }}
                      className="press flex w-full items-center gap-3.5 px-3.5 py-3 text-left text-ink"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[.05]">
                        <Icon name={g.icon as IconName} size={19} strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16.5px] font-semibold leading-tight">{g.title}</span>
                        <span className="block truncate text-[12.5px] text-ink-soft">{g.note}</span>
                      </span>
                      <Icon name={g.href ? "chevron" : "down"} size={17} className={`text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && !g.href && (
                        <m.ul className="m-0 list-none border-t border-[var(--line)] p-0" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          {g.items.map((r) => (
                            <li key={r.href + r.title}>
                              <Link href={r.href} onClick={onClose} className="press flex items-center gap-3 py-2.5 pl-[68px] pr-3.5 text-ink no-underline hover:bg-black/[.03]">
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[15px] font-medium leading-tight">{r.title}</span>
                                  <span className="block truncate text-[12px] text-ink-soft">{r.note}</span>
                                </span>
                                <Icon name="chevron" size={15} className="text-ink-faint" />
                              </Link>
                            </li>
                          ))}
                        </m.ul>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </m.nav>
        </div>
      )}
    </AnimatePresence>
  );
}

// The dock: a voice note (to anyone; it says who is waiting for your reply),
// a photo, and ⋯ for the rooms (Memories, Kitchen, Care, Family, Get-together).
function Dock() {
  const { openAdd, openRoom, refreshKey, chromeHidden } = useShell();
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
                <button type="button" onClick={voice} aria-label={pagePerson && pagePerson.id !== viewer.id ? `Voice note to ${callName(pagePerson)}` : "Voice note"} className="press relative grid h-14 w-14 place-items-center rounded-full bg-black text-white">
                  <Icon name="mic" size={23} strokeWidth={1.9} />
                  {waiting.size > 0 && !pagePerson && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#e5484d] px-1 text-[11px] font-bold" aria-label={`${waiting.size} waiting for your reply`}>
                      {waiting.size}
                    </span>
                  )}
                </button>
              ) : (
                <Link href="/settings#invite" aria-label="Invite family" className="press grid h-14 w-14 place-items-center rounded-full bg-black text-white no-underline">
                  <Icon name="plus" size={23} />
                </Link>
              )}
              <button type="button" onClick={() => openAdd("photos")} aria-label="Share a photo or video" className="press grid h-14 w-14 place-items-center rounded-full text-ink">
                <Icon name="camera" size={23} strokeWidth={1.9} />
              </button>
              <button type="button" onClick={() => openRoom("all")} aria-label="Rooms: memories, kitchen, care, family, get-together" className="press grid h-14 w-14 place-items-center rounded-full text-ink">
                <Icon name="more" size={24} strokeWidth={2} />
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
