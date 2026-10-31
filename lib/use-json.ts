"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Last good payload per URL: a route paints from it at once and refreshes in
// the background. Kept in memory and (small payloads) in sessionStorage.
const cache = new Map<string, unknown>();
const KEY = "aangan:json:";
const MAX_STORED = 400_000;

export function readCache<T>(url: string): T | null {
  if (cache.has(url)) return cache.get(url) as T;
  try {
    const raw = sessionStorage.getItem(KEY + url);
    if (raw) {
      const v = JSON.parse(raw) as T;
      cache.set(url, v);
      return v;
    }
  } catch {
    /* no sessionStorage, or a bad entry */
  }
  return null;
}

function writeCache(url: string, value: unknown): void {
  cache.set(url, value);
  try {
    const raw = JSON.stringify(value);
    if (raw.length <= MAX_STORED) sessionStorage.setItem(KEY + url, raw);
  } catch {
    /* quota or private mode: memory only */
  }
}

/** Forget every cached payload (sign-in, sign-out, switching family). */
export function clearJsonCache(): void {
  cache.clear();
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(KEY)) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
if (typeof window !== "undefined") window.addEventListener("aangan:auth", clearJsonCache);

/**
 * One refresh of `url`. A good response replaces the cache. A failed one keeps
 * whatever was cached: `stale` is true (show a quiet "offline" hint), and
 * `failed` only when there is nothing at all to show.
 */
export async function revalidate<T>(url: string, f: typeof fetch = (...a) => fetch(...a)): Promise<{ data: T | null; stale: boolean; failed: boolean }> {
  try {
    const res = await f(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as T;
    writeCache(url, json);
    return { data: json, stale: false, failed: false };
  } catch {
    const kept = readCache<T>(url);
    return { data: kept, stale: kept !== null, failed: kept === null };
  }
}

/**
 * Fetch JSON for a room; `reload` after a write. Null while loading.
 * Stale-while-revalidate: the last good payload for the URL shows at once and
 * is refreshed in the background; `stale` marks data that could not be
 * refreshed. `every` (ms) also refetches quietly while the page is visible:
 * on an interval and when the tab comes back.
 */
export function useJson<T>(url: string | null, opts?: { every?: number }): { data: T | null; stale: boolean; failed: boolean; reload: () => Promise<void> } {
  const every = opts?.every;
  // Memory only at first, so the first client render matches the server's (null).
  const [data, setData] = useState<T | null>(() => (url && cache.has(url) ? (cache.get(url) as T) : null));
  const [stale, setStale] = useState(false);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  const load = useCallback(async (quiet: boolean) => {
    if (!url) return;
    if (!quiet) setFailed(false);
    const r = await revalidate<T>(url);
    if (!live.current) return;
    if (r.data !== null) setData(r.data);
    setStale(r.stale);
    setFailed(!quiet && r.failed);
  }, [url]);
  useEffect(() => {
    live.current = true;
    const cached = url ? readCache<T>(url) : null;
    if (cached) setData(cached);
    void load(false);
    return () => {
      live.current = false;
    };
  }, [load, url]);
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
  return { data, stale, failed, reload };
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
