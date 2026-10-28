"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Fetch JSON for a room; `reload` after a write. Null while loading. */
export function useJson<T>(url: string | null): { data: T | null; failed: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  const reload = useCallback(async () => {
    if (!url) return;
    setFailed(false);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as T;
      if (live.current) setData(json);
    } catch {
      if (live.current) setFailed(true);
    }
  }, [url]);
  useEffect(() => {
    live.current = true;
    void reload();
    return () => {
      live.current = false;
    };
  }, [reload]);
  return { data, failed, reload };
}

/** POST JSON; returns parsed body or null on failure. */
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown, method = "POST"): Promise<T | null> {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** "12 min ago", "3 h ago", "yesterday". */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
