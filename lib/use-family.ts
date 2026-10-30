"use client";

import { useEffect, useState } from "react";
import type { Card } from "./schemas";

// One shared, cached fetch of the family's cards. Every screen reads from the
// same snapshot, so navigating between rooms never flashes empty or refetches
// needlessly. refreshKey (from the shell) forces a revalidation after uploads.

let cache: Card[] | null = null;
let inflight: Promise<Card[]> | null = null;
const listeners = new Set<(cards: Card[]) => void>();

// The server already joins the demo shelf (demo family only) and holds back
// today's sealed answers, so the client takes the list as given.
function merge(server: Card[]): Card[] {
  return [...server].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

async function load(): Promise<Card[]> {
  if (inflight) return inflight;
  inflight = fetch("/api/cards", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ cards: Card[]; familyId?: string }>) : { cards: [] as Card[], familyId: undefined }))
    .then((d) => merge(d.cards))
    .catch(() => [] as Card[])
    .then((cards) => {
      cache = cards;
      inflight = null;
      listeners.forEach((l) => l(cards));
      return cards;
    });
  return inflight;
}

export function useFamilyCards(refreshKey = 0): { cards: Card[] | null } {
  const [cards, setCards] = useState<Card[] | null>(cache);
  useEffect(() => {
    listeners.add(setCards);
    void load();
    return () => {
      listeners.delete(setCards);
    };
  }, [refreshKey]);
  return { cards };
}

/** Forget the cached snapshot (sign-out, switching family). */
export function resetFamilyCards(): void {
  cache = null;
  inflight = null;
}
