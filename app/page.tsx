"use client";

import { useCallback, useEffect, useState } from "react";
import { Courtyard } from "@/components/courtyard";
import { DoorTransition } from "@/components/door";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";
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

  const gate = !ready || open === null ? "checking" : !signedIn ? "landing" : open ? "family" : "lite";

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
  if (gate === "landing")
    return (
      <Landing
        onDemo={async () => {
          const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inviteCode: "AANGAN-DEMO", memberId: "arjun" }) });
          if (res.ok) {
            resetFamilyCards();
            window.dispatchEvent(new Event("aangan:auth"));
          }
        }}
      />
    );
  return (
    <>
      {gate === "lite" ? <LiteWindow onOpenDoor={() => setMoving("opening")} /> : <Courtyard onCloseDoor={() => setMoving("closing")} />}
      <DoorTransition state={moving} onDone={settle} />
    </>
  );
}
