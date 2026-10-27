import type { z } from "zod";
import { DEMO_MEMBERS } from "./family";
import { CardSchema, MemberSchema, type Card, type Member } from "./schemas";

// Demo backing store. Supabase replaces this when the project is confirmed;
// the function shapes stay the same. Accepts schema *input* so Zod defaults
// apply at the boundary.
let cards: Card[] = [];
let members: Member[] = [];

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

export function listMembers(): Member[] {
  return [...members];
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
  seedDemo();
}

if (cards.length === 0) seedDemo();
if (members.length === 0) members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));
