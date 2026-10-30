// The light in the window (SPEC §30.1). One lamp per home. Lighting it, or
// any real contact from that home (a voice, a photo, a call), keeps it bright;
// it fades over three days of silence. The window shows the light between two
// homes: whichever of them reached out last. Pure helpers (client + server).
import type { Card } from "./schemas";
import type { Lamp } from "./kinds";

export const FADE_HOURS = 72;
/** A heartbeat waits this long to be felt, then it's gone (no backlog of old pulses). */
export const BEAT_TTL_MS = 2 * 86_400_000;

export function glowFrom(lastAt: string | null, now = Date.now()): number {
  if (!lastAt) return 0;
  const h = (now - Date.parse(lastAt)) / 3_600_000;
  if (h <= 0) return 1;
  return Math.max(0, Math.round((1 - h / FADE_HOURS) * 100) / 100);
}

/** The latest sign from a home: its lamp, or anything its people shared. */
export function lastContact(lamp: Lamp | undefined, memberIds: string[], cards: Pick<Card, "authorId" | "takenAt">[], now = Date.now()): { at: string | null; by: string | null } {
  const ids = new Set(memberIds);
  let at = lamp?.litAt ?? null;
  let by = lamp?.litBy ?? null;
  for (const c of cards) {
    if (!c.authorId || !ids.has(c.authorId) || Date.parse(c.takenAt) > now) continue;
    if (!at || c.takenAt > at) {
      at = c.takenAt;
      by = c.authorId;
    }
  }
  return { at, by };
}

/** Heartbeats waiting for this member: sent to their home, after the last one they felt. */
export function pendingBeats(lamp: Lamp | undefined, memberId: string, now = Date.now()): { from: string; at: string }[] {
  if (!lamp) return [];
  const felt = lamp.felt[memberId] ?? "";
  return lamp.beats.filter((b) => b.from !== memberId && b.at > felt && now - Date.parse(b.at) < BEAT_TTL_MS);
}
