// Together (server): the family quiz, grounded in the family's own data.
// Templates live in together-templates.ts (shared with the client).
import { z } from "zod";
export { TEMPLATES, template, type TogetherTemplate } from "./together-templates";
import { QuizItemSchema, type Pet, type QuizItem, type Recipe } from "./kinds";
import { museJson } from "./muse";
import type { Member } from "./schemas";

// ---------- Family quiz: grounded in the family's own data ----------
export interface QuizFacts {
  recipes: Pick<Recipe, "title" | "cookId" | "memory">[];
  members: Pick<Member, "id" | "displayName" | "tz" | "birthday" | "role">[];
  pets: Pick<Pet, "name" | "species" | "livesWith">[];
}

const PLACE = (tz: string) => tz.split("/").pop()?.replace(/_/g, " ") ?? tz;

/** Deterministic questions straight from the data (mock mode and fallback). */
export function mockQuiz(f: QuizFacts): QuizItem[] {
  const name = (id: string) => f.members.find((m) => m.id === id)?.displayName ?? "someone";
  const cooks = Array.from(new Set(f.members.map((m) => m.displayName)));
  const out: QuizItem[] = [];
  const pick = <T,>(arr: T[], n: number, seed: number) => arr.filter((_, i) => (i + seed) % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);
  for (const r of f.recipes.slice(0, 4)) {
    const right = name(r.cookId);
    const wrong = cooks.filter((c) => c !== right).slice(0, 2);
    const options = [right, ...wrong].sort();
    out.push({ q: `Whose recipe is "${r.title}"?`, options, answer: options.indexOf(right), from: "the Kitchen" });
  }
  const far = f.members.filter((m) => m.role !== "child");
  for (const m of pick(far, 2, 1)) {
    const right = PLACE(m.tz);
    const options = Array.from(new Set([right, ...f.members.map((x) => PLACE(x.tz))])).slice(0, 3).sort();
    if (options.length > 1) out.push({ q: `Which city's time is ${m.displayName} living on?`, options, answer: options.indexOf(right), from: "the family" });
  }
  for (const p of f.pets.slice(0, 2)) {
    const right = name(p.livesWith);
    const options = Array.from(new Set([right, ...cooks])).slice(0, 3).sort();
    out.push({ q: `Who does ${p.name} the ${p.species} live with?`, options, answer: options.indexOf(right), from: "Pets" });
  }
  const birthdays = f.members.filter((m) => m.birthday).slice(0, 2);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  for (const m of birthdays) {
    const mi = Number(m.birthday.slice(0, 2)) - 1;
    const options = [MONTHS[mi], MONTHS[(mi + 4) % 12], MONTHS[(mi + 8) % 12]].sort();
    out.push({ q: `In which month is ${m.displayName}'s birthday?`, options, answer: options.indexOf(MONTHS[mi]), from: "Occasions" });
  }
  return out.slice(0, 10);
}

const QUIZ_SYSTEM = [
  "Write a fun family quiz from the facts given. Reply with JSON only: {\"items\": [{\"q\": str, \"options\": [str, str, str], \"answer\": index, \"from\": str}]}",
  "8 to 10 questions. Every question and right answer must come from the facts; never invent a fact about a person. Wrong options may be other family members, cities or months from the facts.",
  "Warm and playful, for all ages. No questions about health, money, age or appearance.",
].join("\n");

export async function familyQuiz(familyId: string, facts: QuizFacts): Promise<{ items: QuizItem[]; source: "muse" | "fallback" }> {
  const fallback = mockQuiz(facts);
  const Schema = z.object({ items: z.array(QuizItemSchema).min(3).max(12) });
  const words = new Set([...facts.recipes.map((r) => r.title.toLowerCase()), ...facts.members.map((m) => m.displayName.toLowerCase()), ...facts.pets.map((p) => p.name.toLowerCase())]);
  const out = await museJson({
    familyId,
    purpose: "Wrote a family quiz from your own memories",
    system: QUIZ_SYSTEM,
    user: JSON.stringify(facts),
    schema: Schema,
    mock: () => ({ items: fallback.length >= 3 ? fallback : [...fallback, ...fallback].slice(0, 3) }),
    fallback: { items: fallback },
    maxTokens: 1500,
    // Grounding: most questions must mention a real name, recipe or pet.
    accept: (d) => d.items.filter((i) => Array.from(words).some((w) => i.q.toLowerCase().includes(w) || i.options.some((o) => o.toLowerCase() === w))).length >= Math.ceil(d.items.length * 0.7) && d.items.every((i) => i.answer < i.options.length),
  });
  return { items: out.data.items, source: out.source };
}
