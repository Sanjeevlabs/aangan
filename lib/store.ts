import type { Card } from "./schemas";

// Demo backing store. Supabase replaces this when configured;
// the function shapes stay the same.
let cards: Card[] = [];

export function listCards(): Card[] {
  return [...cards].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

export function addCard(card: Card): Card {
  cards = cards.filter((c) => c.id !== card.id);
  cards.push(card);
  return card;
}

export function clearCards(): void {
  cards = [];
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

if (cards.length === 0) seedDemo();
