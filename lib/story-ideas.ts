// Stories to tell (SPEC §29.14): well-known folk tales, in our own short
// outlines, for a parent or grandparent to retell in their own voice. The
// telling is theirs; the outline is only a memory jog. Data, not logic.

export interface StoryIdea {
  id: string;
  title: string;
  /** Who tells it best: anyone; the outline keeps it short. */
  ages: "under-5" | "5-8" | "9-12" | "all";
  /** Three beats to jog the memory, never a script. */
  beats: [string, string, string];
  /** What the child takes away. */
  lesson: string;
}

export const STORY_IDEAS: StoryIdea[] = [
  { id: "monkey-crocodile", title: "The monkey and the crocodile", ages: "5-8", beats: ["A monkey shares sweet jamun fruit with a crocodile every day", "The crocodile's wife wants the monkey's heart, so he tricks the monkey onto his back", "Mid-river, the monkey says he left his heart up in the tree, and escapes"], lesson: "Keep a calm head when you are in trouble" },
  { id: "thirsty-crow", title: "The thirsty crow", ages: "under-5", beats: ["A crow, very thirsty on a hot day, finds a pot with a little water at the bottom", "His beak can't reach, so he drops in pebbles, one by one", "The water rises and he drinks"], lesson: "Patience and a little thinking solve big problems" },
  { id: "lion-mouse", title: "The lion and the mouse", ages: "under-5", beats: ["A lion catches a tiny mouse and lets it go when it begs", "Later the lion is caught in a hunter's net", "The mouse chews the ropes and frees him"], lesson: "No one is too small to help" },
  { id: "tortoise-geese", title: "The tortoise who talked too much", ages: "5-8", beats: ["Two geese carry their friend the tortoise across the sky on a stick", "He must hold the stick in his mouth and not speak", "People below laugh, he answers back, and lets go"], lesson: "Some moments call for staying quiet" },
  { id: "blue-jackal", title: "The blue jackal", ages: "5-8", beats: ["A jackal falls into a vat of blue dye", "The forest animals think he is a strange new king", "When the jackals howl, he howls too, and everyone knows him"], lesson: "Be who you are; pretending doesn't last" },
  { id: "clever-hare", title: "The hare and the lion in the well", ages: "5-8", beats: ["A greedy lion eats one animal every day", "A small hare, late on purpose, says another lion lives in the well", "The lion roars at his reflection, jumps in, and the forest is free"], lesson: "Wit beats strength" },
  { id: "golden-goose", title: "The goose with golden feathers", ages: "9-12", beats: ["A kind goose gives a poor family one golden feather at a time", "Someone gets greedy and plucks every feather at once", "The feathers turn ordinary and the goose never returns"], lesson: "Greed loses what patience would have kept" },
  { id: "elephant-rope", title: "The elephant and the thin rope", ages: "9-12", beats: ["A huge elephant stands tied with just a thin rope", "It was tied with that rope as a baby, when it couldn't break free", "It still believes it can't, so it never tries"], lesson: "Old limits aren't always real" },
  { id: "your-own", title: "A story only you know", ages: "all", beats: ["The house you grew up in, or the walk to school", "Something that went wrong, and what you did", "What you learnt that you still use"], lesson: "Where the family comes from" },
];

/** Today's suggestion: rotates by day, skipping titles this family already has. */
export function ideaFor(date: string, told: string[]): StoryIdea {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const fresh = STORY_IDEAS.filter((s) => !told.some((t) => t.toLowerCase().includes(s.title.toLowerCase().replace(/^the /, ""))));
  const pool = fresh.length ? fresh : STORY_IDEAS;
  return pool[day % pool.length];
}
