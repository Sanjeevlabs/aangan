// Who may take what outside the family, as cards, stickers or links. One
// table, read by screens (to hide the button) and by routes (enforced).
// Pure: client and server.
//
//   photo print card   only the person who shared the photo; image only, never a link
//   photo cut-out      only the person who shared it, and only a grown-up (a teen's
//                      photo may show other children; a parent's may show their own)
//   recipe card/link   grown-ups (owner, admin, member), as /api/share enforces
//   recipe sticker     same as the recipe card
//   occasion card      owner and admins (it shows everyone who wished)
//   family tree        grown-ups (poster and badge show faces, children's too)
//   quote / blessing   the person who said it, or owner and admins
//   today's answer     your own answer only
//   lamp sticker       anyone in the family
// Voices never leave the app: every share is an image or a link to a frozen text copy.
import { isAdmin, isGrownUp } from "./permissions";
import type { Card, Member } from "./schemas";

type Viewer = Pick<Member, "id" | "access"> & { status?: Member["status"] };

const active = (v: Viewer | null | undefined): v is Viewer => Boolean(v && v.status !== "pending" && v.access !== "child");

export function canSharePhoto(viewer: Viewer | null | undefined, card: Pick<Card, "type" | "authorId"> | null | undefined): boolean {
  return active(viewer) && Boolean(card && card.type === "photo" && card.authorId && card.authorId === viewer.id);
}

export function canCutOutPhoto(viewer: Viewer | null | undefined, card: Pick<Card, "type" | "authorId"> | null | undefined): boolean {
  return canSharePhoto(viewer, card) && isGrownUp(viewer);
}

export function canShareRecipe(viewer: Viewer | null | undefined): boolean {
  return active(viewer) && isGrownUp(viewer);
}

export function canShareOccasion(viewer: Viewer | null | undefined): boolean {
  return active(viewer) && isAdmin(viewer);
}

export function canShareTree(viewer: Viewer | null | undefined): boolean {
  return active(viewer) && isGrownUp(viewer);
}

/** A story, a piece of advice or a blessing: whoever said it, or the family's admins. */
export function canShareQuote(viewer: Viewer | null | undefined, speakerId: string | null | undefined): boolean {
  if (!active(viewer) || !speakerId) return false;
  return speakerId === viewer.id || isAdmin(viewer);
}

export function canShareTodayAnswer(viewer: Viewer | null | undefined, answerBy: string | null | undefined): boolean {
  return active(viewer) && Boolean(answerBy) && answerBy === viewer.id;
}

export function canMakeLampSticker(viewer: Viewer | null | undefined): boolean {
  return active(viewer);
}
