// Data-access seam: mock memory store vs Supabase.
// Every route handler goes through these async functions; the shapes match
// lib/store.ts (plus the M3–M5 entities below). Tests import lib/store.ts
// directly and stay mock-only — this module is never exercised by vitest
// with MOCK=true.
import { isMockMode } from "./config";
import {
  addCard as memAddCard,
  addPlay as memAddPlay,
  addRelationship as memAddRelationship,
  getKinshipTerms as memGetKinship,
  getMember as memGetMember,
  listCards as memListCards,
  listMembers as memListMembers,
  listPlays as memListPlays,
  listReactions as memListReactions,
  listRelationships as memListRelationships,
  setKinshipTerms as memSetKinship,
  setMemberDisplayLang as memSetDisplayLang,
  setMemberHome as memSetHome,
  setReaction as memSetReaction,
  mockAddMember as memAddMember,
} from "./store";
import { isDbLive, supabaseServer } from "./supabase";
import { CardSchema, MemberSchema, PlaySchema, ReactionSchema, RelationshipSchema, type Card, type Member, type Play, type Reaction, type Relationship } from "./schemas";

function live(): boolean {
  return !isMockMode() && isDbLive();
}

function cardFromRow(r: Record<string, unknown>): Card {
  return CardSchema.parse({
    id: r.id,
    familyId: r.family_id,
    type: r.type,
    caption: r.caption ?? "",
    summary: r.summary ?? "",
    lang: r.lang ?? "en",
    takenAt: r.taken_at instanceof Date ? r.taken_at.toISOString() : (r.taken_at as string),
    ritualSlug: (r.ritual_slug as string | null) ?? null,
    source: (r.source as string) ?? "upload",
    mediaRef: (r.media_ref as string | null) ?? null,
    peaks: Array.isArray(r.peaks) ? (r.peaks as number[]) : [],
    palette: Array.isArray(r.palette) ? (r.palette as string[]) : [],
    transcript: (r.transcript as string) ?? "",
    transcriptLang: (r.transcript_lang as string) ?? "en",
    segments: Array.isArray(r.segments) ? r.segments : [],
  });
}

function memberFromRow(r: Record<string, unknown>): Member {
  return MemberSchema.parse({
    id: r.id,
    familyId: r.family_id,
    firstName: r.first_name ?? r.display_name ?? "",
    displayName: r.display_name ?? "",
    role: r.role ?? "adult",
    lang: r.lang ?? "en",
    displayLang: r.display_lang ?? "en",
    tz: r.tz ?? "UTC",
    birthday: r.birthday ?? "01-01",
    homeImageRef: (r.home_image_ref as string | null) ?? null,
    homePalette: Array.isArray(r.home_palette) ? (r.home_palette as string[]) : [],
  });
}

export async function dbListCards(familyId = "demo-family"): Promise<Card[]> {
  if (!live()) return memListCards();
  const sb = supabaseServer();
  if (!sb) return memListCards();
  const { data, error } = await sb.from("cards").select("*").eq("family_id", familyId).order("taken_at", { ascending: false });
  if (error || !data) return memListCards();
  return data.map(cardFromRow);
}

export async function dbAddCard(input: Omit<Card, "id"> & { id?: string }): Promise<Card> {
  const card = CardSchema.parse({ id: input.id ?? crypto.randomUUID(), ...input });
  if (!live()) return memAddCard(card);
  const sb = supabaseServer();
  if (!sb) return memAddCard(card);
  const { error } = await sb.from("cards").upsert({
    id: card.id,
    family_id: card.familyId,
    type: card.type,
    caption: card.caption,
    summary: card.summary,
    lang: card.lang,
    taken_at: card.takenAt,
    ritual_slug: card.ritualSlug,
    source: card.source,
    media_ref: card.mediaRef,
    peaks: card.peaks,
    palette: card.palette,
    transcript: card.transcript,
    transcript_lang: card.transcriptLang,
    segments: card.segments,
  });
  if (error) return memAddCard(card);
  return card;
}

export async function dbListMembers(familyId = "demo-family"): Promise<Member[]> {
  if (!live()) return memListMembers();
  const sb = supabaseServer();
  if (!sb) return memListMembers();
  const { data, error } = await sb.from("members").select("*").eq("family_id", familyId);
  if (error || !data || data.length === 0) return memListMembers();
  return data.map(memberFromRow);
}

export async function dbGetMember(id: string): Promise<Member | undefined> {
  if (!live()) return memGetMember(id);
  const sb = supabaseServer();
  if (!sb) return memGetMember(id);
  const { data, error } = await sb.from("members").select("*").eq("id", id).maybeSingle();
  if (error || !data) return memGetMember(id);
  return memberFromRow(data as Record<string, unknown>);
}

export async function dbSetMemberHome(memberId: string, homeImageRef: string, homePalette: string[]): Promise<Member | undefined> {
  if (!live()) return memSetHome(memberId, homeImageRef, homePalette);
  const sb = supabaseServer();
  if (!sb) return memSetHome(memberId, homeImageRef, homePalette);
  const { error } = await sb.from("members").update({ home_image_ref: homeImageRef, home_palette: homePalette }).eq("id", memberId);
  if (error) return undefined;
  return dbGetMember(memberId);
}

export async function dbSetMemberDisplayLang(memberId: string, displayLang: Member["displayLang"]): Promise<Member | undefined> {
  if (!live()) return memSetDisplayLang(memberId, displayLang);
  const sb = supabaseServer();
  if (!sb) return memSetDisplayLang(memberId, displayLang);
  const lang = displayLang === "hi-deva" ? "hi" : "en";
  const { error } = await sb.from("members").update({ display_lang: displayLang, lang }).eq("id", memberId);
  if (error) return undefined;
  return dbGetMember(memberId);
}

export async function dbListPlays(cardId?: string): Promise<Play[]> {
  if (!live()) return memListPlays(cardId);
  const sb = supabaseServer();
  if (!sb) return memListPlays(cardId);
  let q = sb.from("plays").select("*").order("played_at", { ascending: false });
  if (cardId) q = q.eq("card_id", cardId);
  const { data, error } = await q;
  if (error || !data) return memListPlays(cardId);
  return data.map((r) =>
    PlaySchema.parse({
      id: r.id,
      familyId: r.family_id,
      cardId: r.card_id,
      memberId: r.member_id,
      playedAt: r.played_at instanceof Date ? r.played_at.toISOString() : (r.played_at as string),
    }),
  );
}

export async function dbAddPlay(input: { cardId: string; memberId: string; familyId?: string }): Promise<Play> {
  const play = PlaySchema.parse({
    id: crypto.randomUUID(),
    familyId: input.familyId ?? "demo-family",
    playedAt: new Date().toISOString(),
    ...input,
  });
  if (!live()) return memAddPlay(play);
  const sb = supabaseServer();
  if (!sb) return memAddPlay(play);
  const { error } = await sb.from("plays").insert({
    id: play.id,
    family_id: play.familyId,
    card_id: play.cardId,
    member_id: play.memberId,
    played_at: play.playedAt,
  });
  if (error) return memAddPlay(play);
  return play;
}

export async function dbListReactions(cardId?: string): Promise<Reaction[]> {
  if (!live()) return memListReactions(cardId);
  const sb = supabaseServer();
  if (!sb) return memListReactions(cardId);
  let q = sb.from("reactions").select("*").order("created_at", { ascending: true });
  if (cardId) q = q.eq("card_id", cardId);
  const { data, error } = await q;
  if (error || !data) return memListReactions(cardId);
  return data.map((r) =>
    ReactionSchema.parse({
      id: r.id,
      familyId: r.family_id,
      cardId: r.card_id,
      memberId: r.member_id,
      kind: r.kind,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : (r.created_at as string),
    }),
  );
}

export async function dbListRelationships(familyId = "demo-family"): Promise<Relationship[]> {
  if (!live()) return memListRelationships();
  const sb = supabaseServer();
  if (!sb) return memListRelationships();
  const { data, error } = await sb.from("relationships").select("*").eq("family_id", familyId);
  if (error || !data || data.length === 0) return memListRelationships();
  return data.map((r) =>
    RelationshipSchema.parse({
      id: r.id,
      familyId: r.family_id,
      memberId: r.member_id,
      relationMemberId: r.relation_member_id,
      relation: r.relation,
      canonicalKind: canonicalKindFor(r.relation),
    }),
  );
}

// Canonical edge kind from the family's own word. Data in, data out.
export function canonicalKindFor(relation: string): Relationship["canonicalKind"] {
  const w = relation.toLowerCase().trim();
  if (["mother", "father", "mom", "dad", "maa", "pita", "parent", "saas", "sasur"].includes(w)) return "parent";
  if (["daughter", "son", "child", "beti", "beta", "bahu", "damad"].includes(w)) return "child";
  if (["wife", "husband", "spouse", "partner", "patni", "pati"].includes(w)) return "spouse";
  return "sibling";
}

export async function dbAddRelationship(input: {
  memberId: string;
  newMemberName: string;
  newMemberRole?: Member["role"];
  relation: string;
  familyId?: string;
}): Promise<{ member: Member; relationship: Relationship }> {
  const familyId = input.familyId ?? "demo-family";
  const memberId = `member-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const member = MemberSchema.parse({
    id: memberId,
    familyId,
    firstName: input.newMemberName,
    displayName: input.newMemberName,
    role: input.newMemberRole ?? "adult",
    lang: "en",
    displayLang: "en",
    tz: "UTC",
    birthday: "01-01",
    homeImageRef: null,
    homePalette: [],
  });
  const relationship = RelationshipSchema.parse({
    id: crypto.randomUUID(),
    familyId,
    memberId: input.memberId,
    relationMemberId: memberId,
    relation: input.relation,
    canonicalKind: canonicalKindFor(input.relation),
  });
  if (!live()) {
    // Mock path mutates the in-memory family (tests reset it first).
    memAddRelationship(relationship);
    memAddMember(member);
    return { member, relationship };
  }
  const sb = supabaseServer();
  if (!sb) {
    memAddRelationship(relationship);
    memAddMember(member);
    return { member, relationship };
  }
  const [{ error: mErr }, { error: rErr }] = await Promise.all([
    sb.from("members").insert({
      id: member.id,
      family_id: familyId,
      first_name: member.firstName,
      display_name: member.displayName,
      role: member.role,
      lang: member.lang,
      display_lang: member.displayLang,
      tz: member.tz,
      birthday: member.birthday,
    }),
    sb.from("relationships").insert({
      id: relationship.id,
      family_id: familyId,
      member_id: input.memberId,
      relation_member_id: memberId,
      relation: input.relation,
    }),
  ]);
  if (mErr || rErr) {
    memAddRelationship(relationship);
    memAddMember(member);
  }
  return { member, relationship };
}

export async function dbGetKinshipTerms(path: string, displayLang: string): Promise<string | undefined> {
  if (!live()) return memGetKinship(path, displayLang);
  const sb = supabaseServer();
  if (!sb) return memGetKinship(path, displayLang);
  const { data } = await sb.from("kinship_cache").select("terms").eq("path", path).eq("display_lang", displayLang).maybeSingle();
  const terms = (data as { terms?: unknown } | null)?.terms;
  if (terms && typeof terms === "object" && typeof (terms as { text?: unknown }).text === "string") {
    return (terms as { text: string }).text;
  }
  return memGetKinship(path, displayLang);
}

export async function dbSetKinshipTerms(path: string, displayLang: string, terms: string): Promise<void> {
  memSetKinship(path, displayLang, terms);
  if (!live()) return;
  const sb = supabaseServer();
  if (!sb) return;
  await sb.from("kinship_cache").upsert({ path, display_lang: displayLang, terms: { text: terms } });
}

export async function dbSetReaction(input: { cardId: string; memberId: string; kind: Reaction["kind"]; familyId?: string }): Promise<Reaction> {
  const reaction = ReactionSchema.parse({
    id: crypto.randomUUID(),
    familyId: input.familyId ?? "demo-family",
    createdAt: new Date().toISOString(),
    ...input,
  });
  if (!live()) return memSetReaction(reaction);
  const sb = supabaseServer();
  if (!sb) return memSetReaction(reaction);
  const { error } = await sb.from("reactions").upsert(
    {
      id: reaction.id,
      family_id: reaction.familyId,
      card_id: reaction.cardId,
      member_id: reaction.memberId,
      kind: reaction.kind,
      created_at: reaction.createdAt,
    },
    { onConflict: "card_id,member_id" },
  );
  if (error) return memSetReaction(reaction);
  return reaction;
}
