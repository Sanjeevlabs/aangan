// Family portrait + photo restore: the rules, shared by the screen (to show
// what you may do) and the route (to enforce it). Pure, client-safe.
//
// Guardrails, all in one place:
// - Always a painted style. There is no photorealistic option, and every
//   output carries a "Painted by Muse" / "Restored by Muse" mark in the pixels.
// - Only people in this family, at most 10 (the Muse Image reference limit).
// - Teens and children never start a portrait. A grown-up may include a child
//   only when they share a home with that child or are the child's parent.
// - Nothing is posted until a person taps Keep.
import type { Member, Relationship } from "./schemas";
import { households, householdOf } from "./households";
import { isGrownUp } from "./permissions";

export const PORTRAIT_MAX_PEOPLE = 10;
export const PORTRAIT_DAILY_LIMIT = 5;
export const RESTORE_DAILY_LIMIT = 10;
/** What one Muse Image render is budgeted at against the shared spend cap (USD). */
export const MUSE_IMAGE_ESTIMATE_USD = 0.08;

export const PORTRAIT_STYLES = ["watercolour", "oil", "pencil", "festive"] as const;
export type PortraitStyle = (typeof PORTRAIT_STYLES)[number];

export const STYLE_LOOK: Record<PortraitStyle, { label: string; note: string; prompt: string }> = {
  watercolour: {
    label: "Watercolour",
    note: "Soft washes on paper",
    prompt: "a loose, warm watercolour painting on textured cotton paper, soft washes, visible brush strokes and paper grain",
  },
  oil: {
    label: "Oil painting",
    note: "Rich, like a heirloom",
    prompt: "a classical oil painting on canvas, rich warm palette, visible impasto brushwork, like a family heirloom portrait",
  },
  pencil: {
    label: "Pencil sketch",
    note: "Graphite on cream paper",
    prompt: "a hand-drawn graphite pencil sketch on cream paper, cross-hatching, soft smudged shading, no colour",
  },
  festive: {
    label: "Festive illustration",
    note: "Bright, with lights and marigolds",
    prompt: "a bright flat storybook illustration with warm string lights and marigold garlands around the family, gouache texture",
  },
};

export type MuseRunKind = "portrait" | "restore";

/** Under 18 in this app: a child profile, or a teen / child account. */
export function isMinor(m: Pick<Member, "role" | "access">): boolean {
  return m.role === "child" || m.access === "teen" || m.access === "child";
}

/** Only grown-ups with their own account start a portrait. */
export function canStartPortrait(viewer: Pick<Member, "role" | "access" | "status"> | null | undefined): boolean {
  if (!viewer || viewer.status === "pending") return false;
  return isGrownUp(viewer) && !isMinor(viewer);
}

function isParentOf(parentId: string, childId: string, rels: Relationship[]): boolean {
  return rels.some(
    (r) => (r.memberId === childId && r.relationMemberId === parentId && r.canonicalKind === "parent") || (r.memberId === parentId && r.relationMemberId === childId && r.canonicalKind === "child"),
  );
}

/** May this viewer put this person in a portrait? */
export function canInclude(viewer: Member, target: Member, members: Member[], rels: Relationship[]): boolean {
  if (!canStartPortrait(viewer)) return false;
  if (target.familyId !== viewer.familyId) return false;
  if (target.status === "pending") return false;
  if (!isMinor(target)) return true;
  if (isParentOf(viewer.id, target.id, rels)) return true;
  const home = householdOf(target.id, households(members, rels));
  return Boolean(home?.members.some((m) => m.id === viewer.id));
}

export type PickProblem = "not-allowed" | "too-few" | "too-many" | "outside-family" | "child-not-allowed" | "duplicate";

/** Checks a requested set of people. Null when it is fine. */
export function checkPick(viewer: Member, ids: string[], members: Member[], rels: Relationship[]): PickProblem | null {
  if (!canStartPortrait(viewer)) return "not-allowed";
  if (new Set(ids).size !== ids.length) return "duplicate";
  if (ids.length < 1) return "too-few";
  if (ids.length > PORTRAIT_MAX_PEOPLE) return "too-many";
  for (const id of ids) {
    const m = members.find((x) => x.id === id);
    if (!m || m.familyId !== viewer.familyId) return "outside-family";
    if (!canInclude(viewer, m, members, rels)) return "child-not-allowed";
  }
  return null;
}

/** How many renders of this kind the family has left today (UTC day). */
export function quotaLeft(runs: { kind: MuseRunKind; at: string }[], kind: MuseRunKind, now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  const used = runs.filter((r) => r.kind === kind && r.at.slice(0, 10) === day).length;
  return Math.max(0, (kind === "portrait" ? PORTRAIT_DAILY_LIMIT : RESTORE_DAILY_LIMIT) - used);
}

/** The prompt sent with the reference photos. Painted, never photographic; only the people given. */
export function portraitPrompt(style: PortraitStyle, names: string[]): string {
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return [
    `Paint one group family portrait of exactly ${names.length} ${names.length === 1 ? "person" : "people"}: ${who}.`,
    `Each attached reference image is one of them, in this order: ${names.join(", ")}.`,
    "Keep every face recognisably theirs: same age, skin tone, hair and expression. Do not add, remove or merge anyone.",
    "Arrange them close together, warm and natural, elders seated in the middle, children in front.",
    `Style: ${STYLE_LOOK[style].prompt}.`,
    "It must look painted by hand, never like a photograph. No text, no logos, no watermark, no signature.",
  ].join(" ");
}

export const RESTORE_PROMPT =
  "Restore this old family photograph. Remove scratches, dust, creases and stains, recover faded contrast, and add gentle natural colour if it is black and white. " +
  "Keep every person's face, expression, pose and clothing exactly as they are; do not add, remove or beautify anyone. Keep the original framing. No text, no watermark.";

export const PORTRAIT_MARK = "Painted by Muse";
export const RESTORE_MARK = "Restored by Muse";
export const SAMPLE_MARK = "Sample: Muse is off";

/** The label every viewer shows for a card Muse made, or null for a person's own photo. */
export function museLabel(source: string | null | undefined): string | null {
  if (source === "muse-portrait") return PORTRAIT_MARK;
  if (source === "muse-restored") return RESTORE_MARK;
  return null;
}
