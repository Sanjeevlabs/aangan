"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetch JSON for a room; `reload` after a write. Null while loading.
 * `every` (ms) also refetches quietly while the page is visible: on an
 * interval and when the tab comes back. A failed quiet refetch keeps the data.
 */
export function useJson<T>(url: string | null, opts?: { every?: number }): { data: T | null; failed: boolean; reload: () => Promise<void> } {
  const every = opts?.every;
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  const load = useCallback(async (quiet: boolean) => {
    if (!url) return;
    if (!quiet) setFailed(false);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as T;
      if (live.current) setData(json);
    } catch {
      if (live.current && !quiet) setFailed(true);
    }
  }, [url]);
  useEffect(() => {
    live.current = true;
    void load(false);
    return () => {
      live.current = false;
    };
  }, [load]);
  const reload = useCallback(() => load(false), [load]);
  useEffect(() => {
    if (!url || !every) return;
    const tick = () => {
      if (!document.hidden) void load(true);
    };
    const timer = setInterval(tick, every);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [url, every, load]);
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
