"use client";

import { useCallback, useEffect, useState } from "react";

// Elder mode: larger text and targets. On by default for the grandparent
// generation; anyone can switch it in Settings (kept per device).
const KEY = "aangan:large-text";
const EVENT = "aangan:large-text";

function read(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

export function useLargeText(defaultOn: boolean): [boolean, (on: boolean) => void] {
  const [pref, setPref] = useState<boolean | null>(null);
  useEffect(() => {
    setPref(read());
    const on = () => setPref(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = useCallback((on: boolean) => {
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* private mode: this session only */
    }
    setPref(on);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [pref ?? defaultOn, set];
}
