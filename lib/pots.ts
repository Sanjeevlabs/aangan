// Flower pots on the first screen (sill, balcony, courtyard floor). They bloom
// with the family: more flowers open as the home's lamp glows brighter, and on
// a day someone shared a voice or a photo. They never wilt: the floor is a
// green, healthy plant with a flower or two (the product rule is never guilt).
// Pure helpers (client + server).
import type { Pot } from "./kinds";

export const POT_LOOK: Record<Pot, { label: string; flowers: number }> = {
  marigold: { label: "Marigold", flowers: 5 },
  rose: { label: "Rose", flowers: 3 },
  jasmine: { label: "Jasmine", flowers: 9 },
  geranium: { label: "Geranium", flowers: 3 },
  moneyplant: { label: "Money plant", flowers: 4 },
  succulent: { label: "Succulent", flowers: 3 },
};

/** The floor: never below this, whatever happens (or doesn't). */
export const HEALTHY = 0.2;

/**
 * How much the pots bloom, 0..1 and never below HEALTHY. Rises with the lamp
 * glow (0..1, lib/lamp.ts glowFrom) and with a voice or photo shared today.
 * Monotonic in both.
 */
export function bloomFrom(glow: number, sharedToday: boolean): number {
  const g = Number.isFinite(glow) ? Math.min(1, Math.max(0, glow)) : 0;
  const b = HEALTHY + 0.55 * g + (sharedToday ? 0.25 : 0);
  return Math.round(Math.min(1, Math.max(HEALTHY, b)) * 100) / 100;
}

/** How many of a plant's flowers are open at this bloom (at least one). */
export function openFlowers(pot: Pot, bloom: number): number {
  const n = POT_LOOK[pot].flowers;
  return Math.max(1, Math.min(n, Math.round(Math.max(HEALTHY, bloom) * n)));
}

/** A voice note or photo from anyone in the family, shared today (their own day, this device's clock). */
export function sharedToday(cards: { type: string; takenAt: string }[], now = new Date()): boolean {
  const day = now.toDateString();
  return cards.some((c) => (c.type === "audio" || c.type === "photo" || c.type === "video") && Date.parse(c.takenAt) <= now.getTime() && new Date(c.takenAt).toDateString() === day);
}
