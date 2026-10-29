"use client";

import { useEffect, useState } from "react";
import { Home } from "@/components/home";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";
import { Landing, Welcome } from "@/components/welcome";
import { resetFamilyCards } from "@/lib/use-family";

const ENTERED_KEY = "aangan:entered";

// Signed out -> Landing. Signed in -> the Welcome greeting once per session,
// then the courtyard.
export default function Page() {
  const { setChromeHidden } = useShell();
  const { ready, signedIn } = useViewer();
  const [entered, setEntered] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setEntered(sessionStorage.getItem(ENTERED_KEY) === "1");
    } catch {
      setEntered(true);
    }
  }, []);

  const gate = !ready || entered === null ? "checking" : !signedIn ? "landing" : entered ? "home" : "welcome";

  useEffect(() => {
    setChromeHidden(gate !== "home");
  }, [gate, setChromeHidden]);

  if (gate === "checking") return <div className="fixed inset-0 z-30 bg-white" aria-busy="true" aria-label="Opening Aangan" />;
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
  if (gate === "welcome")
    return (
      <Welcome
        onEnter={() => {
          try {
            sessionStorage.setItem(ENTERED_KEY, "1");
          } catch {
            /* private mode */
          }
          setEntered(true);
        }}
      />
    );
  return <Home />;
}
