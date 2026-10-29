// Stories: a grandparent tells it, Muse only labels it (title, theme, ages,
// one line). Muse never writes, finishes or "improves" the story itself.
// Server only.
import { z } from "zod";
import { STORY_AGES, STORY_THEMES } from "./kind-values";
import { describeLang } from "./languages";
import { museJson } from "./muse";

export const StoryLabelSchema = z.object({
  title: z.string().min(1).max(80),
  theme: z.enum(STORY_THEMES),
  ages: z.enum(STORY_AGES),
  summary: z.string().max(200),
});
export type StoryLabel = z.infer<typeof StoryLabelSchema>;

const SYSTEM = [
  "A grandparent told a story to the children in their family. Label it. Reply with JSON only:",
  '{"title": str (short, warm, in the language of the story), "theme": one of ' + STORY_THEMES.join("|") + ', "ages": one of ' + STORY_AGES.join("|") + ', "summary": one sentence a parent would read}',
  "Rules: use only what was said. Never add events, morals or characters. No judgement of the story.",
].join("\n");

// Word lists, matched as whole words in any script (JS \b is ASCII-only, so
// Hindi needs letter-aware boundaries).
const words = (list: string) => new RegExp(`(?<![\\p{L}\\p{M}])(${list})(?![\\p{L}\\p{M}])`, "iu");
const THEME_WORDS: [(typeof STORY_THEMES)[number], RegExp][] = [
  ["lullaby", words("lori|lullaby|so ja|sleep|neend|नींद|सो जा|लोरी")],
  ["animals", words("elephant|monkey|tiger|lion|crow|parrot|cow|dog|cat|haathi|bandar|sher|kauwa|tota|हाथी|बंदर|शेर|कौआ|तोता|गाय")],
  ["legends", words("king|raja|rani|queen|god|bhagwan|ganesh|krishna|hanuman|राजा|रानी|भगवान|गणेश|कृष्ण|हनुमान")],
  ["our-village", words("village|gaon|mela|fair|river|field|well|गाँव|मेला|मेले|नदी|खेत|कुआँ")],
  ["family", words("your dad|your papa|your grandfather|when your|tumhare papa|तुम्हारे पापा|तुम्हारे दादा|शादी|wedding")],
  ["funny", words("laugh|funny|silly|hasi|हँसी|मज़ा")],
  ["lesson", words("lesson|learn|never lie|honest|sach|सच|सीख")],
];

export function mockStoryLabel(transcript: string, title?: string): StoryLabel {
  const text = transcript.replace(/\s+/g, " ").trim();
  const theme = THEME_WORDS.find(([, re]) => re.test(text))?.[0] ?? "other";
  const first = text.split(/(?<=[.!?।])\s+/)[0] ?? text;
  return StoryLabelSchema.parse({
    title: (title?.trim() || first.replace(/[.!?।]+$/, "")).slice(0, 60) || "A story",
    theme,
    ages: theme === "lullaby" ? "under-5" : "all",
    summary: first.slice(0, 200),
  });
}

export async function labelStory(input: { familyId: string; transcript: string; lang: string; tellerName: string; title?: string }): Promise<{ label: StoryLabel; source: "muse" | "fallback" }> {
  const fallback = mockStoryLabel(input.transcript, input.title);
  if (!input.transcript.trim()) return { label: fallback, source: "fallback" };
  const out = await museJson({
    familyId: input.familyId,
    purpose: `Labelled a story ${input.tellerName} told`,
    system: SYSTEM,
    user: `Teller: ${input.tellerName}\nLanguage: ${describeLang(input.lang)}\n${input.title ? `Title they chose: ${input.title}\n` : ""}Transcript:\n${input.transcript.slice(0, 6000)}`,
    schema: StoryLabelSchema,
    mock: () => mockStoryLabel(input.transcript, input.title),
    fallback,
    maxTokens: 300,
  });
  return { label: input.title ? { ...out.data, title: input.title.slice(0, 80) } : out.data, source: out.source };
}

/** Story starters from the family's own life; the teller picks or ignores them. */
export function storyStarters(tellerRole: "elder" | "adult" | "child", childNames: string[]): string[] {
  const kid = childNames[0] ?? "the children";
  const base = [
    "The day you got lost at the mela",
    "How you learned to swim, or ride a cycle",
    `What ${kid}'s papa was like at their age`,
    "The animal that lived near your home when you were small",
    "A story your own grandmother told you",
    "The naughtiest thing you ever did",
    "A lullaby you sang to your children",
  ];
  return tellerRole === "child" ? ["Something funny that happened at school", "Your favourite place in the world"] : base;
}
