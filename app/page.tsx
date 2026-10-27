"use client";

import { useEffect, useState } from "react";
import { Home } from "@/components/home";
import { useShell } from "@/components/shell";
import { Welcome } from "@/components/welcome";

const ENTERED_KEY = "aangan:entered";

export default function Page() {
  const { setWashPalette, setChromeHidden } = useShell();
  const [entered, setEntered] = useState<boolean | null>(null);

  useEffect(() => {
    setEntered(sessionStorage.getItem(ENTERED_KEY) === "1");
  }, []);

  useEffect(() => {
    setChromeHidden(entered === false);
  }, [entered, setChromeHidden]);

  if (entered === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="skeleton mb-2 h-10 w-40" />
        <div className="skeleton h-40" />
      </div>
    );
  }

  if (!entered) {
    return (
      <Welcome
        onEnter={() => {
          sessionStorage.setItem(ENTERED_KEY, "1");
          setWashPalette([]);
          setEntered(true);
        }}
      />
    );
  }

  return <Home />;
}
