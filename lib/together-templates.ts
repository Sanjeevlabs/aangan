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
  { id: "antakshari", kind: "play", title: "Antakshari across homes", blurb: "The song game, one home against another.", minutes: 40, ages: "All", people: "2+ homes", needs: ["A Sit together room"], steps: ["Split into teams by home", "Sing a song; the next team starts with its last letter", "Elders are judges"], roles: ["Judge", "Score keeper"], tasks: ["Pick a date", "Make teams", "Choose the judge"], sitReason: "music" },
  { id: "baby-photo", kind: "play", title: "Guess the baby photo", blurb: "Everyone sends a baby photo. Who is who?", minutes: 20, ages: "All", people: "Everyone", needs: ["Old photos"], steps: ["Everyone privately adds a baby photo", "Reveal one by one on a call", "Elders tell the story behind each"], roles: ["Host"], tasks: ["Collect a baby photo from every home", "Pick a date", "Host the reveal"], sitReason: "just-sit" },
  { id: "two-truths", kind: "play", title: "Two truths and a lie: grandparents' edition", blurb: "Dadi and Dada say three things about their youth. The kids guess the lie.", minutes: 20, ages: "6+", people: "Grandparents + kids", needs: [], steps: ["Each grandparent thinks of two true things and one made-up", "Kids guess", "The true stories become voice notes"], roles: ["Storyteller"], tasks: ["Pick a date", "Grandparents prepare three things each"], sitReason: "story" },
  { id: "cookbook", kind: "make", title: "The family cookbook", blurb: "One recipe from every home by Sunday. Together, it's a book.", minutes: null, ages: "All", people: "One cook per home", needs: [], steps: ["Each home adds one recipe to the Kitchen", "Elders teach theirs by voice", "When every home has one, print or share the book"], roles: ["Editor"], tasks: ["Each home adds one recipe", "Elders record one by voice", "Pick a cover photo"], muse: "cookbook" },
  { id: "plant", kind: "make", title: "Plant something in every home", blurb: "The same plant in every home. Watch them grow apart, together.", minutes: 20, ages: "All", people: "Every home", needs: ["A pot", "Seeds or a sapling"], steps: ["Agree on a plant", "Plant it the same weekend", "Share a photo every month"], roles: [], tasks: ["Choose the plant", "Plant it this weekend", "First photo"] },
  { id: "decorate", kind: "make", title: "Decorate together for a festival", blurb: "Same theme, every home, then show each other.", minutes: 60, ages: "All", people: "Every home", needs: ["Lights, colours, flowers"], steps: ["Pick a theme", "Decorate on the same day", "Show each other on a call"], roles: [], tasks: ["Choose a theme", "Each home decorates", "Share photos"], sitReason: "festival" },
  { id: "word-a-day", kind: "learn", title: "A word a day", blurb: "For seven days a grandparent teaches a grandchild one word of their language.", minutes: 2, ages: "3+", people: "A grandparent + a grandchild", needs: [], steps: ["The grandparent records one word and a sentence each day", "The child says it back by voice", "Day 7: a little conversation"], roles: ["Teacher", "Learner"], tasks: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7: talk together"], muse: "words" },
  { id: "homework", kind: "learn", title: "Homework hour with a grandparent", blurb: "Maths tables, a poem, a Hindi lesson. Grandparents are the best tutors.", minutes: 30, ages: "6+", people: "A grandparent + a grandchild", needs: ["A Sit together room", "The homework"], steps: ["Book the same time each week", "The child shares the page on camera", "Grandparent helps, parent stays out"], roles: ["Tutor"], tasks: ["Pick a weekly time", "First session"], sitReason: "just-sit" },
  { id: "skill", kind: "learn", title: "Teach me your skill", blurb: "Knitting, rangoli, a cricket grip, a song on the harmonium.", minutes: 30, ages: "All", people: "Anyone who knows something", needs: ["Whatever the skill needs"], steps: ["Pick the skill", "Teach it live or record it", "The learner shows their first try"], roles: ["Teacher", "Learner"], tasks: ["Choose the skill", "Book the session", "Share the first try"], sitReason: "just-sit" },
  { id: "birthday-surprise", kind: "celebrate", title: "Surprise for someone's birthday", blurb: "Wishes from every home, a song, a card. Delivered at 8 am their time.", minutes: null, ages: "All", people: "Everyone but them", needs: [], steps: ["Everyone records a wish", "Pick a song together", "Aangan delivers it on the morning"], roles: ["Organiser"], tasks: ["Everyone records a wish", "Choose a song", "Order a cake or flowers"], sitReason: "birthday" },
  { id: "visit", kind: "visit", title: "Plan a visit home", blurb: "Dates, tickets, what to bring, what Maa will cook. With a countdown both homes can see.", minutes: null, ages: "All", people: "The traveller and the home", needs: [], steps: ["Set the dates", "Book tickets", "Gifts from abroad and what to cook at home", "Countdown on the courtyard"], roles: ["Traveller", "Host"], tasks: ["Fix the dates", "Book tickets", "List gifts to bring", "Plan the first meal at home", "Clean the room"] },
];

export function template(id: string): TogetherTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

