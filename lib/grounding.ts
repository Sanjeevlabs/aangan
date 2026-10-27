// Grounding guardrail: every name in the caption must be a tagged member
// of the card. Cheap subset check; fails closed to a fallback caption.
export function groundedNames(captionNames: string[], taggedMembers: string[]): boolean {
  const tagged = new Set(taggedMembers.map((n) => n.trim().toLowerCase()));
  return captionNames.every((n) => tagged.has(n.trim().toLowerCase()));
}

export function stripUngroundedNames(captionNames: string[], taggedMembers: string[]): string[] {
  const tagged = new Set(taggedMembers.map((n) => n.trim().toLowerCase()));
  const keep = new Map(taggedMembers.map((n) => [n.trim().toLowerCase(), n]));
  const out: string[] = [];
  for (const n of captionNames) {
    const hit = keep.get(n.trim().toLowerCase());
    if (hit && tagged.has(n.trim().toLowerCase())) out.push(hit);
  }
  return out;
}
