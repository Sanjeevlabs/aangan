// Together templates: ready-made things a family can do across homes. Data
// only (client and server), like ritual configs: no culture or festival is
// hard-coded in logic.
import type { PROJECT_KINDS } from "./kind-values";

export interface TogetherTemplate {
  id: string;
  kind: (typeof PROJECT_KINDS)[number];
  title: string;
  blurb: string;
  minutes: number | null;
  ages: string;
  people: string;
  needs: string[];
  steps: string[];
  roles: string[];
  tasks: string[];
  /** What Muse does for it, if anything (shown on the card). */
  muse?: "quiz" | "words" | "cookbook";
  /** Books a Sit together with this reason. */
  sitReason?: "chai" | "cook" | "story" | "festival" | "birthday" | "music" | "just-sit";
}

export const TEMPLATES: TogetherTemplate[] = [
  { id: "quiz-night", kind: "play", title: "Family quiz night", blurb: "How well do you know your own family? Questions about your recipes, your people and your stories.", minutes: 30, ages: "6+", people: "Everyone, on a call", needs: ["A Sit together room", "Phones"], steps: ["Pick a quizmaster", "Muse writes the questions from your family's own memories", "Join the call; the quizmaster reads, everyone shouts answers", "Keep the funniest moment"], roles: ["Quizmaster"], tasks: ["Pick a date that works for every home", "Choose a quizmaster", "Generate the questions", "Tell everyone"], muse: "quiz", sitReason: "just-sit" },
  { id: "cookbook", kind: "make", title: "The family cookbook", blurb: "One recipe from every home by Sunday. Together, it's a book.", minutes: null, ages: "All", people: "One cook per home", needs: [], steps: ["Each home adds one recipe to the Kitchen", "Elders teach theirs by voice", "When every home has one, print or share the book"], roles: ["Editor"], tasks: ["Each home adds one recipe", "Elders record one by voice", "Pick a cover photo"], muse: "cookbook" },
  { id: "word-a-day", kind: "learn", title: "A word a day", blurb: "For seven days a grandparent teaches a grandchild one word of their language.", minutes: 2, ages: "3+", people: "A grandparent + a grandchild", needs: [], steps: ["The grandparent records one word and a sentence each day", "The child says it back by voice", "Day 7: a little conversation"], roles: ["Teacher", "Learner"], tasks: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7: talk together"], muse: "words" },
  { id: "birthday-surprise", kind: "celebrate", title: "Surprise for someone's birthday", blurb: "Wishes from every home, a song, a card. Delivered at 8 am their time.", minutes: null, ages: "All", people: "Everyone but them", needs: [], steps: ["Everyone records a wish", "Pick a song together", "Aangan delivers it on the morning"], roles: ["Organiser"], tasks: ["Everyone records a wish", "Choose a song", "Order a cake or flowers"], sitReason: "birthday" },
  { id: "visit", kind: "visit", title: "Plan a visit home", blurb: "Dates, tickets, what to bring, what Maa will cook. With a countdown both homes can see.", minutes: null, ages: "All", people: "The traveller and the home", needs: [], steps: ["Set the dates", "Book tickets", "Gifts from abroad and what to cook at home", "Countdown on the courtyard"], roles: ["Traveller", "Host"], tasks: ["Fix the dates", "Book tickets", "List gifts to bring", "Plan the first meal at home", "Clean the room"] },
];

export function template(id: string): TogetherTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

