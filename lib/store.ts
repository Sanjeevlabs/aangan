import type { z } from "zod";
import { DEMO_MEMBERS } from "./family";
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
  member.lang = displayLang === "hi-deva" ? "hi" : "en";
  return { ...member };
}

export function seedDemo(): void {
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
  members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));
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
}

export function getKinshipTerms(path: string, displayLang: string): string | undefined {
  return kinshipCache.get(`${path}::${displayLang}`);
}

export function setKinshipTerms(path: string, displayLang: string, terms: string): void {
  kinshipCache.set(`${path}::${displayLang}`, terms);
}

if (relationships.length === 0) clearRelationships();

if (cards.length === 0) seedDemo();
if (members.length === 0) members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));
