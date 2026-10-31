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
import { resetFamilyCards } from "@/lib/use-family";

const DOOR_KEY = "aangan:door";

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

  if (gate === "checking") return <div className="lite-ground fixed inset-0 z-30" aria-busy="true" aria-label="Opening Aangan" />;
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
