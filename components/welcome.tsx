"use client";

import Link from "next/link";
import { useState } from "react";
import { greetingForHour } from "@/lib/i18n";
import { resolveMediaUrl } from "@/lib/media-session";
import { Button, Photo } from "./ui/kit";
import { useViewer } from "./viewer";

const COURTYARD = "/demo/courtyard.jpg";

/** Full-bleed photo with a glass card at the bottom: the frame for every entry screen. */
export function EntryFrame({ image = COURTYARD, children }: { image?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 overflow-hidden bg-[#2a211c]">
      <Photo src={image} alt="" sizes="100vw" priority />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" aria-hidden="true" />
      <div className="relative mx-auto flex h-full max-w-[480px] flex-col px-4" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <p className="m-0 px-2 text-[22px] font-bold tracking-[-0.02em] text-white drop-shadow">Aangan</p>
        <div className="flex-1" />
        <div className="glass rounded-[30px] p-6">{children}</div>
      </div>
    </div>
  );
}

/** Signed out: say what Aangan is, and offer the three ways in. */
export function Landing({ onDemo }: { onDemo: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <EntryFrame>
      <h1 className="m-0 text-[30px] leading-[1.1] text-white">Hear the people you love, every day.</h1>
      <p className="m-0 mt-2 text-[16px] leading-snug text-white/80">A private courtyard for your family&rsquo;s voices, photos and occasions, wherever everyone lives.</p>
      <div className="mt-6 space-y-2.5">
        <Link href="/create" className="press flex h-[52px] items-center justify-center rounded-full bg-white text-[16px] font-semibold text-black no-underline">
          Start your family&rsquo;s Aangan
        </Link>
        <Link href="/join" className="press flex h-[52px] items-center justify-center rounded-full bg-white/20 text-[16px] font-semibold text-white no-underline">
          I have an invite code
        </Link>
      </div>
      <div className="mt-4 flex items-center justify-between px-1 text-[15px]">
        <Link href="/signin" className="flex h-11 items-center font-medium text-white no-underline">
          Sign in
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onDemo();
            setBusy(false);
          }}
          className="flex h-11 items-center font-medium text-white/80"
        >
          {busy ? "Opening…" : "Explore a demo family"}
        </button>
      </div>
    </EntryFrame>
  );
}

/** Signed in, once per session: the home you miss, and one warm signal. */
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const { viewer, signalLine } = useViewer();
  const [hour] = useState(() => new Date().getHours());
  const home = resolveMediaUrl(viewer.homeImageRef) ?? COURTYARD;
  return (
    <EntryFrame image={home}>
      <p className="m-0 text-[15px] text-white/80">Good {greetingForHour(hour)}</p>
      <h1 className="m-0 mt-1 text-[32px] leading-[1.05] text-white">Welcome to {viewer.firstName}&rsquo;s Aangan</h1>
      {signalLine && <p className="voice m-0 mt-3 text-[18px] leading-snug text-white/90">{signalLine}</p>}
      <Button className="mt-6 w-full !bg-white !text-black" onClick={onEnter}>
        Step inside
      </Button>
    </EntryFrame>
  );
}
