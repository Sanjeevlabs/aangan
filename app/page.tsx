"use client";

import { useCallback, useEffect, useState } from "react";
import { Courtyard } from "@/components/courtyard";
import { CourtyardProvider } from "@/lib/courtyard-data";
import { DoorTransition } from "@/components/door";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";
import { HomeSite } from "@/components/home-site";
import { Landing } from "@/components/welcome";
import { LiteWindow } from "@/components/window";
import { Photo } from "@/components/ui/kit";
import { HERO_SIZES } from "@/lib/hero";
import { resetFamilyCards } from "@/lib/use-family";

const DOOR_KEY = "aangan:door";

/**
 * What the server sends and the phone paints before any script has run. Behind the
 * door (the inline script in app/layout.tsx sets html[data-door=open]) that is the
 * courtyard's header photo, in the box the real header uses, so the largest paint
 * does not wait for the bundle; otherwise the plain dark ground. See .door-hero in globals.css.
 */
function CheckingShell() {
  return (
    <div className="lite-ground checking-ground fixed inset-0 z-30" aria-busy="true" aria-label="Opening Aangan">
      <div className="door-hero mx-auto w-full max-w-[480px] px-5" style={{ paddingTop: "calc(32px + env(safe-area-inset-top))" }} aria-hidden="true">
        <div className="relative h-[150px] overflow-hidden rounded-[26px] bg-[#2a211b]">
          <Photo src="/demo/courtyard.jpg" alt="" sizes={HERO_SIZES} position="center 55%" />
        </div>
      </div>
    </div>
  );
}

// Signed out -> Landing. Signed in -> LITE: the window into the other home.
// The door opens the family courtyard; it stays open for the session.
export default function Page() {
  const { setChromeHidden } = useShell();
  const { ready, signedIn } = useViewer();
  const [open, setOpen] = useState<boolean | null>(null);
  const [moving, setMoving] = useState<"opening" | "closing" | null>(null);

  useEffect(() => {
    try {
      setOpen(sessionStorage.getItem(DOOR_KEY) === "open");
    } catch {
      setOpen(false);
    }
  }, []);

  // Wide screens see the home page; phones go straight to the app.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const startDemo = useCallback(async () => {
    const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteCode: "AANGAN-DEMO", memberId: "arjun" }) });
    if (res.ok) {
      resetFamilyCards();
      window.dispatchEvent(new Event("aangan:auth"));
    }
  }, []);

  const gate = !ready || open === null ? "checking" : !signedIn ? "landing" : open ? "family" : "lite";

  useEffect(() => {
    if (gate === "checking") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("demo") !== "1") return;
    url.searchParams.delete("demo");
    window.history.replaceState(null, "", url.pathname + url.search);
    if (gate === "landing") void startDemo();
  }, [gate, startDemo]);

  useEffect(() => {
    setChromeHidden(gate !== "family");
  }, [gate, setChromeHidden]);

  const settle = useCallback(() => {
    const next = moving === "opening";
    try {
      sessionStorage.setItem(DOOR_KEY, next ? "open" : "closed");
    } catch {
      /* private mode */
    }
    setOpen(next);
    setMoving(null);
    window.scrollTo(0, 0);
  }, [moving]);

  if (gate === "checking") return <CheckingShell />;
  if (gate === "landing") return wide ? <HomeSite onDemo={startDemo} /> : <Landing onDemo={startDemo} />;
  return (
    <>
      {gate === "lite" ? <LiteWindow onOpenDoor={() => setMoving("opening")} /> : (
        <CourtyardProvider>
          <Courtyard onCloseDoor={() => setMoving("closing")} />
        </CourtyardProvider>
      )}
      <DoorTransition state={moving} onDone={settle} />
    </>
  );
}
