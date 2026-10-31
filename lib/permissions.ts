// Who may do what in a family. One table, read by route handlers (enforced)
// and by screens (to hide what you can't do). Generation (elder/adult/child)
// is who you are in the tree; access (admin/member/child) is what you may do.
import type { Member } from "./schemas";

export type Action =
  | "tree.add" // add a person or link two people
  | "tree.edit" // edit a person who has no account yet
  | "tree.remove" // remove a person who has no account yet
  | "tree.remove-account" // remove someone who has their own account
  | "roles.assign" // change someone's access
  | "invite.create"
  | "invite.revoke"
  | "care.manage" // care tasks, local helpers, trusted nearby
  | "content.moderate"; // delete someone else's voice note, photo, recipe…

const TABLE: Record<Member["access"], Action[]> = {
  admin: ["tree.add", "tree.edit", "tree.remove", "tree.remove-account", "roles.assign", "invite.create", "invite.revoke", "care.manage", "content.moderate"],
  member: ["tree.add", "tree.edit", "tree.remove", "invite.create", "care.manage"],
  child: [],
};

export function can(who: Pick<Member, "access"> | undefined | null, action: Action): boolean {
  return Boolean(who && TABLE[who.access ?? "member"]?.includes(action));
}

/** Authors manage their own things; admins may remove anything in the family. */
export function canChange(who: Pick<Member, "id" | "access"> | undefined | null, ownerId: string | null | undefined, mode: "edit" | "delete" = "delete"): boolean {
  if (!who) return false;
  if (ownerId && ownerId === who.id) return true;
  return mode === "delete" && can(who, "content.moderate");
}

export const ACCESS_LABEL: Record<Member["access"], { label: string; note: string }> = {
  admin: { label: "Admin", note: "Manages people, roles and invites" },
  member: { label: "Member", note: "Adds family, shares, and helps with care" },
  child: { label: "Child", note: "Talks, shares and cooks; can't change the tree or care" },
};
