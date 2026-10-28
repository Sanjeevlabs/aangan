"use client";

import { useEffect, useState } from "react";
import { Home } from "@/components/home";
import { useShell } from "@/components/shell";
import { Welcome } from "@/components/welcome";

const ENTERED_KEY = "aangan:entered";

// Gate: a valid httpOnly session cookie skips the invite-code step.
// First visit (or expired cookie) shows the code gate inside Welcome.
type Gate = "checking" | "gate" | "intro" | "home";

export default function Page() {
  const { setChromeHidden } = useShell();
  const [gate, setGate] = useState<Gate>("checking");

  useEffect(() => {
    let live = true;
    fetch("/api/session", { cache: "no-store" })
      .then((r) => {
        if (!live) return;
        if (r.ok) {
          setGate(sessionStorage.getItem(ENTERED_KEY) === "1" ? "home" : "intro");
        } else {
          setGate("gate");
        }
      })
      .catch(() => {
        if (live) setGate("gate");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setChromeHidden(gate === "gate" || gate === "intro");
  }, [gate, setChromeHidden]);

  if (gate === "checking") {
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="skeleton mb-2 h-10 w-40" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  if (gate === "home") return <Home />;

  return (
    <Welcome
      needCode={gate === "gate"}
      onEnter={() => {
        sessionStorage.setItem(ENTERED_KEY, "1");
        setGate("home");
      }}
    />
  );
}
