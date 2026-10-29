// The story keeper: once a week, Muse asks each elder one gentle question
// about their life, in their own language. They answer by voice; the answer
// becomes a keepsake for the grandchildren. Muse asks; it never answers,
// never chats, never stands in for the family.
// Server only.
import { z } from "zod";
import { listDocs, newId, putDoc } from "./family-docs";
import type { Question } from "./kinds";
import { describeLang } from "./languages";
import { museJson } from "./muse";
import type { Member } from "./schemas";

const QuestionDraftSchema = z.object({
  text: z.string().min(8).max(200),
  topic: z.enum(["story", "recipe", "wisdom", "song", "place"]),
});

const KEEPER_SYSTEM = [
  "You help a family keep their elder's stories. Write ONE warm, specific question for the elder to answer by voice. Reply JSON only: {\"text\": str, \"topic\": \"story\"|\"recipe\"|\"wisdom\"|\"song\"|\"place\"}.",
  "- Write in the elder's language and script, as a loving grandchild would ask. One sentence, under 25 words.",
  "- Ask about a concrete memory: food, places, songs, festivals, their parents, their first home, how they did everyday things.",
  "- Never ask about illness, death, money, conflict, or anything that could hurt. Never give advice.",
  "- Do not repeat or closely rephrase any previous question.",
].join("\n");

// Mock rotation (no key): concrete, gentle, globally relatable.
const STARTERS: { text: string; topic: Question["topic"] }[] = [
  { text: "What did your mother cook when someone came home after a long journey?", topic: "recipe" },
  { text: "What did the street outside your first home sound like in the morning?", topic: "place" },
  { text: "Which song did you sing while working in the kitchen?", topic: "song" },
  { text: "What is one thing your father taught you that you still do?", topic: "wisdom" },
  { text: "How did your family celebrate the first rain of the year?", topic: "story" },
  { text: "What was your favourite festival food as a child, and who made it?", topic: "recipe" },
  { text: "Where did you go when you wanted to be alone as a young person?", topic: "place" },
];

/** Monday (UTC) of the week containing `at`, YYYY-MM-DD. */
export function weekOf(at: Date = new Date()): string {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Ask every elder who has no Muse question yet this week. Returns the new questions. */
export async function askWeeklyQuestions(familyId: string, members: Member[], now: Date = new Date()): Promise<Question[]> {
  const all = await listDocs(familyId, "question");
  const thisWeek = weekOf(now);
  const created: Question[] = [];
  for (const elder of members.filter((m) => m.role === "elder")) {
    const theirs = all.filter((q) => q.toMemberId === elder.id);
    if (theirs.some((q) => q.madeBy === "muse" && weekOf(new Date(q.createdAt)) === thisWeek)) continue;
    const previous = theirs.map((q) => q.text);
    const fallbackPick = STARTERS.find((s) => !previous.includes(s.text)) ?? STARTERS[theirs.length % STARTERS.length];
    const out = await museJson({
      familyId,
      purpose: `Asked ${elder.displayName} this week's question`,
      system: KEEPER_SYSTEM,
      user: `Elder: ${elder.displayName}\nLanguage: ${describeLang(elder.displayLang)}\nPrevious questions:\n${previous.slice(0, 20).map((p) => `- ${p}`).join("\n") || "- none"}`,
      schema: QuestionDraftSchema,
      mock: () => fallbackPick,
      fallback: fallbackPick,
      maxTokens: 300,
      accept: (d) => !previous.includes(d.text),
    });
    created.push(
      await putDoc(familyId, "question", {
        id: newId("q"),
        toMemberId: elder.id,
        text: out.data.text,
        lang: out.source === "muse" && out.data.text !== fallbackPick.text ? elder.displayLang : "en",
        askedBy: null,
        topic: out.data.topic,
        answeredCardId: null,
        madeBy: "muse",
        createdAt: now.toISOString(),
      }),
    );
  }
  return created;
}
