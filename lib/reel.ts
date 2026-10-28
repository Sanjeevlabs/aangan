// Birthday Reel sequencing (M5): two-way wishes + blessings in collection
// order. Pure and unit-tested; the page adds playback + petals.
import type { Card, Member, RitualRun, Wish } from "./schemas";

export interface ReelSegment {
  wish: Wish;
  member: Member | undefined;
  card: Card | null;
}

/** Wishes for the run, oldest first, each joined to its member + voice card. */
export function buildReelSegments(run: RitualRun, wishes: Wish[], cards: Card[], members: Member[]): ReelSegment[] {
  const byCard = new Map(cards.map((c) => [c.id, c]));
  const byMember = new Map(members.map((m) => [m.id, m]));
  return wishes
    .filter((w) => w.ritualRunId === run.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((wish) => ({
      wish,
      member: byMember.get(wish.memberId),
      card: (wish.cardId && byCard.get(wish.cardId)) || null,
    }));
}

/** "Happy birthday, <viewer-relative name>" — the celebrant's kinship term. */
export function reelTitle(celebrantName: string, kinshipTerms: string | null): string {
  if (kinshipTerms && kinshipTerms !== "family") return `Happy birthday, ${kinshipTerms}`;
  return `Happy birthday, ${celebrantName}`;
}
