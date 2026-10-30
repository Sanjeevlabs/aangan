// Server-side rules for roles (lib/permissions.ts is the table): caps, the
// owner, who may consent for a teen, and recording that consent.
import { dbAddConsent, dbListMembers, dbListRelationships } from "./db";
import { MAX_ADMINS, MAX_PEOPLE, isAdmin } from "./permissions";
import type { Member, Relationship } from "./schemas";

/** Owner + admins in the family (active only; a pending person is nobody yet). */
export function adminCount(members: Member[]): number {
  return members.filter((m) => m.status !== "pending" && isAdmin(m)).length;
}

export function ownerOf(members: Member[]): Member | undefined {
  return members.find((m) => m.access === "owner" && m.status !== "pending");
}

/** Whom a joiner is waiting for: the owner, else the first admin. */
export function hostOf(members: Member[]): Member | undefined {
  return ownerOf(members) ?? members.find((m) => m.status !== "pending" && m.access === "admin");
}

/** At most 50 people per family, everyone counted (waiting joiners too). */
export async function familyFull(familyId: string, extra = 1): Promise<boolean> {
  return (await dbListMembers(familyId, { includePending: true })).length + extra > MAX_PEOPLE;
}

/** Would giving `to` this access break the admin cap (3, owner included)? */
export function breaksAdminCap(members: Member[], target: Member, to: Member["access"]): boolean {
  if (!isAdmin({ access: to }) || isAdmin(target)) return false;
  return adminCount(members) + 1 > MAX_ADMINS;
}

/** A person's parents in the family tree (both edge directions). */
export function parentsOf(memberId: string, rels: Relationship[]): string[] {
  const out = new Set<string>();
  for (const r of rels) {
    if (r.memberId === memberId && r.canonicalKind === "parent") out.add(r.relationMemberId);
    if (r.relationMemberId === memberId && r.canonicalKind === "child") out.add(r.memberId);
  }
  return Array.from(out);
}

/**
 * Who may say yes to a teen account: an owner/admin who is the teen's parent
 * in the tree, or any owner/admin when no parent is linked.
 */
export async function teenConsentProblem(familyId: string, actor: Member, teenId: string): Promise<Response | null> {
  if (!isAdmin(actor) || actor.status === "pending") return Response.json({ error: "not-allowed", action: "roles.assign" }, { status: 403 });
  const parents = parentsOf(teenId, await dbListRelationships(familyId));
  if (parents.length > 0 && !parents.includes(actor.id)) return Response.json({ error: "needs-parent", parents }, { status: 403 });
  return null;
}

/**
 * Record a parent's consent for a teen account. For now the acting admin's
 * signed-in session is the verification ("parent-session-code").
 * TODO(consent): verify the parent's identity with a DigiLocker check
 * (age and guardianship) before the teen account goes live.
 */
export async function recordTeenConsent(familyId: string, teenId: string, parentId: string) {
  return dbAddConsent({ familyId, memberId: teenId, parentMemberId: parentId, kind: "teen-account", method: "parent-session-code" });
}
