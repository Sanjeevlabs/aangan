"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { householdName, talkTarget } from "@/lib/households";
import { callName, peopleByRecency } from "@/lib/people";
import { useFamilyCards } from "@/lib/use-family";
import { useLargeText } from "@/lib/use-large-text";
import dynamic from "next/dynamic";
import type { AddTab, ReplyContribution } from "./add-sheet";

import { PlayerProvider, usePlayer } from "./player";
import { Icon } from "./ui/kit";
import { ViewerProvider, useViewer } from "./viewer";

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
}

const ShellContext = createContext<ShellState | null>(null);

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside Shell");
  return ctx;
}

const ROOMS = [
  { href: "/care", icon: "care", title: "Care circle", note: "Shared tasks, local helpers, whose week" },
  { href: "/safe", icon: "shield", title: "Safe & sound", note: "Home safe, heading home, I need help" },
  { href: "/kitchen", icon: "pot", title: "Kitchen", note: "Recipes in the voices that taught them" },
  { href: "/gather", icon: "door", title: "Sit together", note: "A reason to be in the same room" },
  { href: "/lane", icon: "lane", title: "Memory Lane", note: "Walk back through the years" },
  { href: "/rituals", icon: "calendar", title: "Occasions", note: "Birthdays and festivals ahead" },
  { href: "/bond", icon: "tree", title: "Family", note: "Everyone, and how you're all connected" },
  { href: "/settings", icon: "settings", title: "Settings", note: "Language, time zone, privacy" },
] as const;

function RoomsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <m.button
            type="button"
            aria-label="Close rooms"
            className="absolute inset-0 bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.nav
            className="frost glass-sheet relative mx-3 mb-3 w-full max-w-[460px] p-2"
            style={{ marginBottom: "calc(12px + env(safe-area-inset-bottom))" }}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            <ul className="m-0 list-none p-0">
              {ROOMS.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    onClick={onClose}
                    className="press flex items-center gap-4 rounded-[22px] px-4 py-2.5 text-ink no-underline hover:bg-black/[.04]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/[.05]">
                      <Icon name={r.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold">{r.title}</span>
                      <span className="block text-[14px] text-ink-soft">{r.note}</span>
                    </span>
                    <Icon name="chevron" size={18} className="text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/trace" onClick={onClose} className="flex h-11 items-center justify-center gap-1.5 text-[13px] font-medium text-ink-soft no-underline">
              <Icon name="sparkle" size={14} />
              What Muse did for your family
            </Link>
          </m.nav>
        </div>
      )}
    </AnimatePresence>
  );
}

// The dock replaces a tab bar: one dominant action (answer someone by voice),
// one for moments, one door to the rooms. Shown only in the courtyard.
function Dock() {
  const { openAdd, refreshKey, chromeHidden } = useShell();
  const { viewer, members, relationships } = useViewer();
  const { cards } = useFamilyCards(refreshKey);
  const { current, open: playerOpen } = usePlayer();
  const [rooms, setRooms] = useState(false);
  const pathname = usePathname();

  // On a person's page the dock talks to that person. Elsewhere it talks to
  // a *home*: whoever is waiting for your reply, else the far home you've
  // spoken to least recently (lib/households.ts explains why).
  const pagePerson = pathname.startsWith("/people/") ? members.find((mm) => mm.id === pathname.split("/")[2]) : undefined;
  const target = useMemo(() => {
    if (pagePerson && pagePerson.id !== viewer.id) return { ids: [pagePerson.id], label: callName(pagePerson), reply: false };
    const t = talkTarget(viewer, members, relationships, cards ?? []);
    if (t) return { ids: t.home.members.map((m) => m.id), label: householdName(t.home, (m) => callName(m)), reply: t.reason === "reply" };
    const p = peopleByRecency(viewer.id, members, cards ?? [])[0];
    return p ? { ids: [p.id], label: callName(p), reply: false } : null;
  }, [pagePerson, viewer, members, relationships, cards]);
  const show = (pathname === "/" || pathname.startsWith("/people/")) && !chromeHidden && !playerOpen;

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
              {target ? (
                <button
                  type="button"
                  onClick={() => openAdd("voice", null, target.ids)}
                  className="press flex h-14 max-w-[248px] items-center gap-2.5 whitespace-nowrap rounded-full bg-black pl-2 pr-5 text-[16px] font-semibold text-white"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-marigold text-black">
                    <Icon name="mic" size={20} strokeWidth={2.2} />
                  </span>
                  <span className="truncate">
                    {target.reply ? "Reply to" : "Talk to"} {target.label}
                  </span>
                </button>
              ) : (
                <Link
                  href="/settings#invite"
                  className="press flex h-14 items-center gap-2.5 whitespace-nowrap rounded-full bg-black pl-5 pr-6 text-[16px] font-semibold text-white no-underline"
                >
                  <Icon name="plus" size={20} />
                  Invite family
                </Link>
              )}
              <button
                type="button"
                onClick={() => openAdd("photos")}
                aria-label="Share a photo or video"
                className="press grid h-14 w-14 place-items-center rounded-full"
              >
                <Icon name="camera" size={24} />
              </button>
              <button
                type="button"
                onClick={() => setRooms(true)}
                aria-label="Open rooms"
                className="press grid h-14 w-14 place-items-center rounded-full"
              >
                <Icon name="more" size={24} />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <RoomsSheet open={rooms} onClose={() => setRooms(false)} />
    </>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { viewer } = useViewer();
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
    () => ({ addOpen, addTab, replyTo, addressee, openAdd, closeAdd, refreshKey, bumpRefresh, chromeHidden, setChromeHidden }),
    [addOpen, addTab, replyTo, addressee, openAdd, closeAdd, refreshKey, bumpRefresh, chromeHidden],
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
