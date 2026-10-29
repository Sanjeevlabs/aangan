import { seedDemoRooms } from "./demo-rooms";
import { resetDocs } from "./family-docs";
import type { z } from "zod";
import { DEMO_IYER_MEMBERS, DEMO_MEMBERS } from "./family";
import {
  AgentRunSchema,
  CardSchema,
  DailyRoleSchema,
  GatherSessionSchema,
  MemberSchema,
  PlaySchema,
  ReactionSchema,
  RelationshipSchema,
  RitualRunSchema,
  SuggestionSchema,
  WishSchema,
  type AgentRun,
  type Card,
  type DailyRole,
  type GatherSession,
  type Member,
  type Play,
  type Reaction,
  type ReactionKind,
  type Relationship,
  type RitualRun,
  type Suggestion,
  type Wish,
} from "./schemas";

// Demo backing store. Supabase replaces this when the project is confirmed;
// the function shapes stay the same. Accepts schema *input* so Zod defaults
// apply at the boundary.
let cards: Card[] = [];
let members: Member[] = [];
let plays: Play[] = [];
let reactions: Reaction[] = [];
let relationships: Relationship[] = [];
const kinshipCache = new Map<string, string>();
let suggestions: Suggestion[] = [];
let agentRuns: AgentRun[] = [];
let wishes: Wish[] = [];
let ritualRuns: RitualRun[] = [];
let dailyRoles: DailyRole[] = [];
let gatherSessions: GatherSession[] = [];

export function listCards(): Card[] {
  return [...cards].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

export function addCard(input: z.input<typeof CardSchema>): Card {
  const card = CardSchema.parse(input);
  cards = cards.filter((c) => c.id !== card.id);
  cards.push(card);
  return card;
}

export function clearCards(): void {
  cards = [];
}

export function listPlays(cardId?: string): Play[] {
  const all = [...plays].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  return cardId ? all.filter((p) => p.cardId === cardId) : all;
}

export function addPlay(input: z.input<typeof PlaySchema>): Play {
  const play = PlaySchema.parse(input);
  plays = plays.filter((p) => p.id !== play.id);
  plays.push(play);
  return play;
}

export function clearPlays(): void {
  plays = [];
}

export function listReactions(cardId?: string): Reaction[] {
  const all = [...reactions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return cardId ? all.filter((r) => r.cardId === cardId) : all;
}

// One per member per card: a second reaction from the same member replaces
// the first — never a count, only the latest kind.
export function setReaction(input: z.input<typeof ReactionSchema>): Reaction {
  const reaction = ReactionSchema.parse(input);
  reactions = reactions.filter((r) => !(r.cardId === reaction.cardId && r.memberId === reaction.memberId));
  reactions.push(reaction);
  return reaction;
}

export function clearReactions(): void {
  reactions = [];
}

export function reactionKinds(): ReactionKind[] {
  return ["love", "laugh", "bless"];
}

export function listMembers(): Member[] {
  return [...members];
}

// Mock-only append for guided Bond adds (live path writes to Supabase).
export function mockAddMember(input: z.input<typeof MemberSchema>): Member {
  const member = MemberSchema.parse(input);
  members = members.filter((m) => m.id !== member.id);
  members.push(member);
  return member;
}

export function getMember(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

export function setMemberHome(
  memberId: string,
  homeImageRef: string,
  homePalette: string[],
): Member | undefined {
  const member = members.find((m) => m.id === memberId);
  if (!member) return undefined;
  member.homeImageRef = homeImageRef;
  member.homePalette = homePalette;
  return { ...member };
}

export function setMemberDisplayLang(memberId: string, displayLang: Member["displayLang"]): Member | undefined {
  const member = members.find((m) => m.id === memberId);
  if (!member) return undefined;
  member.displayLang = displayLang;
  member.lang = displayLang.split("-")[0];
  return { ...member };
}

const familyNames = new Map<string, string>([
  ["demo-family", "Sharma"],
  ["demo-iyer", "Iyer"],
]);

export function createFamily(id: string, name: string): void {
  familyNames.set(id, name);
}

export function familyName(id: string): string | undefined {
  return familyNames.get(id);
}


/** Every Aangan this person belongs to (one row per family), by personId. */
export function findMembersByPerson(personId: string): Member[] {
  return members.filter((m) => m.personId === personId).map((m) => ({ ...m }));
}

export function findMemberByEmail(email: string): Member | undefined {
  const e = email.trim().toLowerCase();
  const found = members.find((m) => (m.email ?? "").toLowerCase() === e);
  return found ? { ...found } : undefined;
}

export interface MemberPatch {
  firstName?: string;
  displayName?: string;
  role?: Member["role"];
  access?: Member["access"];
  tz?: string;
  birthday?: string;
  photoRef?: string | null;
  email?: string | null;
  personId?: string | null;
}

export function updateMemberProfile(memberId: string, patch: MemberPatch): Member | undefined {
  const member = members.find((m) => m.id === memberId);
  if (!member) return undefined;
  if (patch.displayName !== undefined) member.displayName = patch.displayName;
  if (patch.role !== undefined) member.role = patch.role;
  if (patch.access !== undefined) member.access = patch.access;
  if (patch.birthday !== undefined) member.birthday = patch.birthday;
  if (patch.email !== undefined) member.email = patch.email;
  if (patch.firstName !== undefined) member.firstName = patch.firstName;
  if (patch.tz !== undefined) member.tz = patch.tz;
  if (patch.photoRef !== undefined) member.photoRef = patch.photoRef;
  if (patch.personId !== undefined) member.personId = patch.personId;
  return { ...member };
}

export function seedDemo(): void {
  seedDemoRooms();
  clearCards();
  addCard({
    id: "demo-diya-1",
    familyId: "demo-family",
    type: "photo",
    caption: "Diyas lit together, miles apart.",
    summary: "Ritual card from the Festival of Lights guide.",
    lang: "en",
    takenAt: "2026-10-26T18:30:00.000Z",
    ritualSlug: "diwali",
  });
  addCard({
    id: "demo-bday-1",
    familyId: "demo-family",
    type: "audio",
    caption: "परिवार ने मिलकर जन्मदिन का गीत गाया।",
    summary: "Birthday ritual voice note.",
    lang: "hi",
    takenAt: "2026-10-20T12:00:00.000Z",
    ritualSlug: "birthday",
  });
}

export function resetDemo(): void {
  members = [...DEMO_MEMBERS, ...DEMO_IYER_MEMBERS].map((m) => MemberSchema.parse(m));
  clearPlays();
  clearReactions();
  clearRelationships();
  kinshipCache.clear();
  suggestions = [];
  agentRuns = [];
  wishes = [];
  ritualRuns = [];
  dailyRoles = [];
  gatherSessions = [];
  clearInvites();
  clearMovableCache();
  resetDocs();
  seedDemo();
}

// Agent proposals: actions execute ONLY on approval via Review / Approve.
export function listSuggestions(status?: Suggestion["status"]): Suggestion[] {
  const all = [...suggestions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return status ? all.filter((s) => s.status === status) : all;
}

export function addSuggestion(input: z.input<typeof SuggestionSchema>): Suggestion {
  const s = SuggestionSchema.parse(input);
  suggestions = suggestions.filter((x) => x.id !== s.id);
  suggestions.push(s);
  return s;
}

export function setSuggestionStatus(id: string, status: Suggestion["status"]): Suggestion | undefined {
  const s = suggestions.find((x) => x.id === id);
  if (!s) return undefined;
  s.status = status;
  return { ...s };
}

export function listAgentRuns(): AgentRun[] {
  return [...agentRuns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addAgentRun(input: z.input<typeof AgentRunSchema>): AgentRun {
  const r = AgentRunSchema.parse(input);
  agentRuns.push(r);
  return r;
}

export function listWishes(runId?: string): Wish[] {
  const all = [...wishes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return runId ? all.filter((w) => w.ritualRunId === runId) : all;
}

export function addWish(input: z.input<typeof WishSchema>): Wish {
  const w = WishSchema.parse(input);
  wishes = wishes.filter((x) => x.id !== w.id);
  wishes.push(w);
  return w;
}

export function listRitualRuns(): RitualRun[] {
  return [...ritualRuns].sort((a, b) => a.occasionDate.localeCompare(b.occasionDate));
}

export function addRitualRun(input: z.input<typeof RitualRunSchema>): RitualRun {
  const r = RitualRunSchema.parse(input);
  ritualRuns = ritualRuns.filter((x) => x.id !== r.id);
  ritualRuns.push(r);
  return r;
}

export function setRitualRunStatus(id: string, status: RitualRun["status"]): RitualRun | undefined {
  const r = ritualRuns.find((x) => x.id === id);
  if (!r) return undefined;
  r.status = status;
  return { ...r };
}

export function dailyRoleOn(memberId: string, roleDate: string): DailyRole | undefined {
  return dailyRoles.find((d) => d.memberId === memberId && d.roleDate === roleDate);
}

export function listDailyRoles(): DailyRole[] {
  return [...dailyRoles];
}

export function assignDailyRole(input: z.input<typeof DailyRoleSchema>): DailyRole {
  const existing = dailyRoleOn(input.memberId, input.roleDate);
  if (existing) return existing;
  const d = DailyRoleSchema.parse(input);
  dailyRoles.push(d);
  return d;
}

export function listGatherSessions(): GatherSession[] {
  return [...gatherSessions].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

// Privacy set: full deletes, no tombstones. Cards belong to the shared
// family pool (no per-card owner in the schema) and are kept; everything
// attributable to the member — wishes, reactions, plays, daily roles — is
// fully deleted.
export function deleteMemberTraces(memberId: string): { wishes: number; reactions: number; plays: number; roles: number } {
  const count = {
    wishes: wishes.filter((w) => w.memberId === memberId).length,
    reactions: reactions.filter((r) => r.memberId === memberId).length,
    plays: plays.filter((p) => p.memberId === memberId).length,
    roles: dailyRoles.filter((d) => d.memberId === memberId).length,
  };
  wishes = wishes.filter((w) => w.memberId !== memberId);
  reactions = reactions.filter((r) => r.memberId !== memberId);
  plays = plays.filter((p) => p.memberId !== memberId);
  dailyRoles = dailyRoles.filter((d) => d.memberId !== memberId);
  return count;
}

export function removeMemberCompletely(memberId: string): boolean {
  const exists = members.some((m) => m.id === memberId);
  if (!exists) return false;
  members = members.filter((m) => m.id !== memberId);
  relationships = relationships.filter((r) => r.memberId !== memberId && r.relationMemberId !== memberId);
  plays = plays.filter((p) => p.memberId !== memberId);
  reactions = reactions.filter((r) => r.memberId !== memberId);
  wishes = wishes.filter((w) => w.memberId !== memberId);
  dailyRoles = dailyRoles.filter((d) => d.memberId !== memberId);
  return true;
}

export interface Invite {
  id: string;
  code: string;
  familyId: string;
  expiresAt: string;
}

let invites: Invite[] = [];

export function listInvites(): Invite[] {
  return [...invites];
}

export function createInvite(code: string, expiresAt: string, familyId = "demo-family"): Invite {
  const invite: Invite = { id: crypto.randomUUID(), code, familyId, expiresAt };
  invites.push(invite);
  return invite;
}

export function clearInvites(): void {
  invites = [];
}

// Movable-date persistent cache: (slug, year) -> grounded ISO date + sources.
// Backed by the ritual_configs row live; memory here for mock/tests.
const movableCache = new Map<string, { date: string; sources: string[] }>();

export function getMovableCache(slug: string, year: number): { date: string; sources: string[] } | undefined {
  return movableCache.get(`${slug}:${year}`);
}

export function setMovableCache(slug: string, year: number, date: string, sources: string[]): void {
  movableCache.set(`${slug}:${year}`, { date, sources });
}

export function clearMovableCache(): void {
  movableCache.clear();
}

export function addGatherSession(input: z.input<typeof GatherSessionSchema>): GatherSession {
  const g = GatherSessionSchema.parse(input);
  gatherSessions = gatherSessions.filter((x) => x.id !== g.id);
  gatherSessions.push(g);
  return g;
}

// Guided Family Bond edges + the viewer-relative kinship cache
// (path + display_lang -> terms). The model runs only on a cache miss.
export function listRelationships(): Relationship[] {
  return [...relationships];
}

export function addRelationship(input: z.input<typeof RelationshipSchema>): Relationship {
  const rel = RelationshipSchema.parse(input);
  relationships = relationships.filter((r) => r.id !== rel.id);
  relationships.push(rel);
  return rel;
}

export function clearRelationships(): void {
  relationships = [];
  // Seed the demo graph: Arjun's mother is Dadi.
  addRelationship({
    id: "rel-arjun-dadi",
    familyId: "demo-family",
    memberId: "arjun",
    relationMemberId: "dadi",
    relation: "mother",
    canonicalKind: "parent",
  });
  // Dadi and Dada share one home in India; Dada is Arjun's father.
  addRelationship({ id: "rel-dadi-dada", familyId: "demo-family", memberId: "dadi", relationMemberId: "dada", relation: "husband", canonicalKind: "spouse" });
  addRelationship({ id: "rel-arjun-dada", familyId: "demo-family", memberId: "arjun", relationMemberId: "dada", relation: "father", canonicalKind: "parent" });
  // Priya is Arjun's wife; Kavya (Bangalore) is his sister, married to Rahul,
  // with a daughter, Anaya. Enough family for the constellation to mean something.
  addRelationship({ id: "rel-arjun-priya", familyId: "demo-family", memberId: "arjun", relationMemberId: "priya", relation: "wife", canonicalKind: "spouse" });
  addRelationship({ id: "rel-arjun-kavya", familyId: "demo-family", memberId: "arjun", relationMemberId: "kavya", relation: "sister", canonicalKind: "sibling" });
  addRelationship({ id: "rel-kavya-rahul", familyId: "demo-family", memberId: "kavya", relationMemberId: "rahul", relation: "husband", canonicalKind: "spouse" });
  addRelationship({ id: "rel-kavya-anaya", familyId: "demo-family", memberId: "kavya", relationMemberId: "anaya", relation: "daughter", canonicalKind: "child" });
  addRelationship({ id: "rel-priya-leo", familyId: "demo-family", memberId: "priya", relationMemberId: "leo", relation: "son", canonicalKind: "child" });
  addRelationship({ id: "rel-priya-aria", familyId: "demo-family", memberId: "priya", relationMemberId: "aria", relation: "daughter", canonicalKind: "child" });
  // Rohan, Arjun's younger brother in London, with Sneha and their son Kabir:
  // cousins and in-laws, not just the household.
  addRelationship({ id: "rel-arjun-rohan", familyId: "demo-family", memberId: "arjun", relationMemberId: "rohan", relation: "brother", canonicalKind: "sibling" });
  addRelationship({ id: "rel-rohan-sneha", familyId: "demo-family", memberId: "rohan", relationMemberId: "sneha", relation: "wife", canonicalKind: "spouse" });
  addRelationship({ id: "rel-rohan-kabir", familyId: "demo-family", memberId: "rohan", relationMemberId: "kabir", relation: "son", canonicalKind: "child" });
  addRelationship({ id: "rel-sneha-kabir", familyId: "demo-family", memberId: "sneha", relationMemberId: "kabir", relation: "son", canonicalKind: "child" });

  // Priya's side, the Iyer Aangan.
  const I = "demo-iyer";
  const rel = (id: string, a: string, b: string, relation: string, canonicalKind: Relationship["canonicalKind"]) => addRelationship({ id, familyId: I, memberId: a, relationMemberId: b, relation, canonicalKind });
  rel("rel-i-nani-nana", "iyer-nani", "iyer-nana", "husband", "spouse");
  rel("rel-i-priya-nani", "iyer-priya", "iyer-nani", "mother", "parent");
  rel("rel-i-priya-nana", "iyer-priya", "iyer-nana", "father", "parent");
  rel("rel-i-priya-arjun", "iyer-priya", "iyer-arjun", "husband", "spouse");
  rel("rel-i-priya-leo", "iyer-priya", "iyer-leo", "son", "child");
  rel("rel-i-priya-aria", "iyer-priya", "iyer-aria", "daughter", "child");
  rel("rel-i-arjun-leo", "iyer-arjun", "iyer-leo", "son", "child");
  rel("rel-i-arjun-aria", "iyer-arjun", "iyer-aria", "daughter", "child");
  rel("rel-i-priya-karthik", "iyer-priya", "iyer-karthik", "brother", "sibling");
  rel("rel-i-karthik-meera", "iyer-karthik", "iyer-meera", "wife", "spouse");
  rel("rel-i-karthik-diya", "iyer-karthik", "iyer-diya", "daughter", "child");
  rel("rel-i-meera-diya", "iyer-meera", "iyer-diya", "daughter", "child");
  // Leo and Aria are Arjun's children.
  for (const kid of ["leo", "aria"]) {
    addRelationship({
      id: `rel-${kid}-arjun`,
      familyId: "demo-family",
      memberId: kid,
      relationMemberId: "arjun",
      relation: "father",
      canonicalKind: "parent",
    });
  }
}

export function getKinshipTerms(path: string, displayLang: string): string | undefined {
  return kinshipCache.get(`${path}::${displayLang}`);
}

export function setKinshipTerms(path: string, displayLang: string, terms: string): void {
  kinshipCache.set(`${path}::${displayLang}`, terms);
}

if (relationships.length === 0) clearRelationships();

if (cards.length === 0) seedDemo();
if (members.length === 0) members = [...DEMO_MEMBERS, ...DEMO_IYER_MEMBERS].map((m) => MemberSchema.parse(m));

// ---- Edit / delete operations (stage 5 CRUD) ----
export function revokeInvite(code: string, familyId: string): boolean {
  const before = invites.length;
  invites = invites.filter((i) => !(i.code.toUpperCase() === code.toUpperCase() && i.familyId === familyId));
  return invites.length < before;
}

export function updateCard(id: string, patch: { caption?: string; transcript?: string; segments?: Card["segments"] }): Card | undefined {
  const card = cards.find((c) => c.id === id);
  if (!card) return undefined;
  if (patch.caption !== undefined) card.caption = patch.caption;
  if (patch.transcript !== undefined) card.transcript = patch.transcript;
  if (patch.segments !== undefined) card.segments = patch.segments;
  return { ...card };
}

export function deleteCard(id: string): boolean {
  const before = cards.length;
  cards = cards.filter((c) => c.id !== id);
  plays = plays.filter((p) => p.cardId !== id);
  reactions = reactions.filter((r) => r.cardId !== id);
  wishes = wishes.filter((w) => w.cardId !== id);
  return cards.length < before;
}

export function removeReaction(cardId: string, memberId: string): boolean {
  const before = reactions.length;
  reactions = reactions.filter((r) => !(r.cardId === cardId && r.memberId === memberId));
  return reactions.length < before;
}

export function deleteRelationship(id: string): boolean {
  const before = relationships.length;
  relationships = relationships.filter((r) => r.id !== id);
  return relationships.length < before;
}
