import type { Member, Reaction } from "./schemas";

// Who reacted, by name ("Maa ❤️ · Papa 🙏"). Family-only, never a count.

export const REACTION_EMOJI: Record<Reaction["kind"], string> = { love: "❤️", bless: "🙏", laugh: "😊" };
export const REACTION_WORD: Record<Reaction["kind"], string> = { love: "love", bless: "blessing", laugh: "smile" };
/** Order on the buttons. */
export const REACTION_ORDER = ["love", "bless", "laugh"] as const;

/** Apply a tap locally: the same kind again takes it back, another kind replaces it. */
export function toggleReaction(list: Reaction[], memberId: string, cardId: string, kind: Reaction["kind"], now = new Date()): Reaction[] {
  const mine = list.find((r) => r.memberId === memberId);
  const rest = list.filter((r) => r.memberId !== memberId);
  if (mine?.kind === kind) return rest;
  return [...rest, { id: mine?.id ?? `local-${memberId}`, familyId: mine?.familyId ?? "", cardId, memberId, kind, createdAt: mine?.createdAt ?? now.toISOString() }];
}

/** "Maa ❤️ · You 🙏": who reacted and how, oldest first. Unknown members are left out. */
export function reactorsText(list: Reaction[], members: Pick<Member, "id" | "displayName" | "firstName">[], viewerId: string): string {
  return [...list]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => {
      const m = members.find((mm) => mm.id === r.memberId);
      if (!m) return null;
      const name = r.memberId === viewerId ? "You" : m.displayName || m.firstName;
      return `${name} ${REACTION_EMOJI[r.kind]}`;
    })
    .filter(Boolean)
    .join(" · ");
}
