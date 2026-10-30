"use client";

// Client side of family events: one fetch for /gather, the event page and
// the in-app prompts, plus the small helpers they share.
import type { FamilyEvent } from "./events";
import type { EventPrompt, UpcomingOccasion } from "./gather-prompts";
import { postJson, useJson } from "./use-json";

export interface EventsPayload {
  events: FamilyEvent[];
  occasions: UpcomingOccasion[];
  prompts: EventPrompt[];
  canPlan: boolean;
  viewerId: string;
}

export function useEvents() {
  return useJson<EventsPayload>("/api/gather/events");
}

export async function eventAction(body: Record<string, unknown>): Promise<{ event?: FamilyEvent; locked?: boolean } | null> {
  return postJson<{ event?: FamilyEvent; locked?: boolean }>("/api/gather/events", body);
}

/** The next event worth showing first: live, then locked soonest, then voting soonest. */
export function nextEvent(events: FamilyEvent[]): FamilyEvent | null {
  const start = (e: FamilyEvent) => e.slots.find((s) => s.id === e.lockedSlotId)?.startsAt ?? `${e.date}T23:59:59Z`;
  return [...events].sort((a, b) => start(a).localeCompare(start(b)))[0] ?? null;
}
