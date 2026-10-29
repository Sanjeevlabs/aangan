// Synthetic content for the demo family's living rooms (Kitchen, Dadi's day,
// care circle, Village, Sit together, the weekly question, Muse activity).
// Times are relative to "now" so the demo always reads as today.
// Every person, place and phone number here is invented.
import { seedDoc } from "./family-docs";
import { hourIn } from "./zones";

const FAM = "demo-family";

function ago(minutes: number, now: number): string {
  return new Date(now - minutes * 60_000).toISOString();
}
function ahead(minutes: number, now: number): string {
  return new Date(now + minutes * 60_000).toISOString();
}

/** Next occurrence of a weekday at a local hour in a zone, as UTC ISO. */
function nextLocal(weekday: number, hour: number, tz: string, now: number): string {
  for (let d = 0; d < 8; d++) {
    const day = new Date(now + d * 86_400_000);
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(day);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    if (wd !== weekday) continue;
    // Build the instant for hour:00 local by correcting a UTC guess with the zone offset.
    const guess = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), hour);
    const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date(guess)));
    const at = guess - (localHour - hour) * 3_600_000;
    if (at > now) return new Date(at).toISOString();
  }
  return ahead(3 * 24 * 60, now);
}

export function seedDemoRooms(now = Date.now()): void {
  // ---------- Albums: Muse sorted the courtyard morning into one ----------
  seedDoc(FAM, "album", { id: "album-courtyard-2019", title: "A Sunday morning in the courtyard", event: "gathering", cardIds: ["demo-years-2", "demo-court-dadi", "demo-court-leo", "demo-court-aria"], startAt: "2019-10-27T08:00:00.000Z", endAt: "2019-10-27T08:38:00.000Z", coverId: "demo-years-2", madeBy: "muse", fixedBy: null, createdAt: "2019-10-27T09:00:00.000Z" });

  // ---------- Around home (Dadi & Dada's neighbourhood) ----------
  seedDoc(FAM, "place", { id: "place-temple", name: "The temple at the corner", kind: "temple", nearMemberId: "dadi", lat: null, lng: null, googlePlaceId: null, note: "Dadi walks here with Mrs. Kapoor most mornings, before the sun gets hot.", cardIds: ["demo-from-dadi-1"], addedBy: "arjun", createdAt: ago(60 * 24 * 9, now) });
  seedDoc(FAM, "place", { id: "place-kirana", name: "Ramesh's kirana", kind: "market", nearMemberId: "dadi", lat: null, lng: null, googlePlaceId: null, note: "Everything for the house; he delivers before 11.", cardIds: [], addedBy: "arjun", createdAt: ago(60 * 24 * 8, now) });
  seedDoc(FAM, "place", { id: "place-courtyard", name: "Home, the courtyard", kind: "home", nearMemberId: "dadi", lat: null, lng: null, googlePlaceId: null, note: "Tulsi in the corner, chai on the steps.", cardIds: ["demo-years-2", "demo-court-dadi", "demo-court-leo"], addedBy: "dadi", createdAt: ago(60 * 24 * 7, now) });

  // ---------- Stories: the kids' corner ----------
  seedDoc(FAM, "story", { id: "story-elephant", tellerId: "dadi", cardId: "demo-story-elephant", title: "The elephant and the tailor", theme: "animals", ages: "5-8", summary: "An elephant, a tailor and a needle; be kind to those who are kind to you.", lang: "hi", questionId: null, madeBy: "muse", createdAt: "2026-10-20T14:10:00.000Z" });
  seedDoc(FAM, "story", { id: "story-mela", tellerId: "dadi", cardId: "demo-story-mela", title: "When I got lost at the fair", theme: "our-village", ages: "all", summary: "Dadi, seven, lost at the Dussehra fair, found from a balloon seller's shoulders.", lang: "hi", questionId: null, madeBy: "muse", createdAt: "2026-10-12T15:30:00.000Z" });
  seedDoc(FAM, "story", { id: "story-mango", tellerId: "dadi", cardId: "demo-story-mango", title: "Your papa and the mango tree", theme: "family", ages: "all", summary: "Papa at eight, stuck at the top of the mango tree behind the courtyard.", lang: "hi", questionId: null, madeBy: "muse", createdAt: "2026-10-05T13:00:00.000Z" });
  seedDoc(FAM, "story", { id: "story-swim", tellerId: "dada", cardId: "demo-story-swim", title: "How Dada learned to swim", theme: "our-village", ages: "5-8", summary: "Dada learns to swim in the Ganga in seven days.", lang: "hi", questionId: null, madeBy: "muse", createdAt: "2026-10-16T12:20:00.000Z" });
  // Leo asked Dada for one; it waits on Dada's courtyard.
  seedDoc(FAM, "question", { id: "tellme-leo-dada", toMemberId: "dada", text: "Tell me a story about a tiger", lang: "en", askedBy: "leo", topic: "story", answeredCardId: null, madeBy: "family", createdAt: ago(60 * 20, now) });

  // ---------- Together: things the family is doing ----------
  seedDoc(FAM, "project", {
    id: "together-visit",
    templateId: "visit",
    title: "Arjun comes home for Diwali week",
    kind: "visit",
    createdBy: "arjun",
    dueAt: ahead(12 * 24 * 60, now),
    visitorId: "arjun",
    hostIds: ["dadi", "dada"],
    tasks: [
      { id: "t-v1", text: "Fix the dates", assignee: "arjun", done: true },
      { id: "t-v2", text: "Book tickets", assignee: "arjun", done: true },
      { id: "t-v3", text: "List gifts to bring", assignee: "priya", done: false },
      { id: "t-v4", text: "Plan the first meal at home", assignee: "dadi", done: false },
      { id: "t-v5", text: "Clean the room upstairs", assignee: "dada", done: false },
    ],
    quiz: [],
    status: "active",
    createdAt: ago(60 * 24 * 3, now),
  });
  seedDoc(FAM, "project", {
    id: "together-cookbook",
    templateId: "cookbook",
    title: "The family cookbook",
    kind: "make",
    createdBy: "priya",
    dueAt: ahead(4 * 24 * 60, now),
    visitorId: null,
    hostIds: [],
    tasks: [
      { id: "t-c1", text: "Each home adds one recipe", assignee: null, done: true },
      { id: "t-c2", text: "Elders record one by voice", assignee: "dadi", done: true },
      { id: "t-c3", text: "Pick a cover photo", assignee: "leo", done: false },
    ],
    quiz: [],
    status: "active",
    createdAt: ago(60 * 24 * 6, now),
  });

  // ---------- Kitchen library: every cook's shelf ----------
  const R = (id: string, cookId: string, title: string, course: string, prepMins: number | null, cookMins: number | null, serves: string, memory: string, prepWork: string[], outcome: string, ingredients: [string, string, string][], steps: [string, string][], daysAgo: number) =>
    seedDoc(FAM, "recipe", {
      id,
      title,
      cookId,
      addedBy: null,
      course,
      prepMins,
      cookMins,
      prepWork,
      outcome,
      voiceCardId: null,
      videoCardId: null,
      coverRef: null,
      memory,
      serves,
      ingredients: ingredients.map(([item, said, approx]) => ({ item, said, approx })),
      steps: steps.map(([text, tip]) => ({ text, tip })),
      lang: "en",
      madeBy: "family",
      createdAt: ago(60 * 24 * daysAgo, now),
    });
  R("recipe-dadi-gobi", "dadi", "Gobi ke pakode", "snack", 15, 20, "4 at tea time", "Only on rainy evenings. The first batch never reached the plates.", ["Cut the cauliflower into small florets", "Soak them in warm salted water 10 min"], "Crisp shell, soft inside; they should sound hollow when tapped.", [["cauliflower", "one small", "≈ 300 g"], ["besan", "two katoris", "≈ 1½ cups"], ["ajwain", "a pinch, crushed", "≈ ½ tsp"], ["red chilli", "a little", "≈ ½ tsp"], ["water", "slowly, till thick", "≈ ¾ cup"], ["oil", "for frying", ""]], [["Make a thick batter with besan, ajwain, chilli and salt.", "It should coat your finger, not drip."], ["Dip each floret and fry on medium heat till golden.", "Don't crowd the kadhai."], ["Drain on paper and serve with green chutney.", ""]], 30);
  R("recipe-dadi-paratha", "dadi", "Aloo paratha", "breakfast", 25, 20, "4 parathas", "Sunday breakfast, with white butter and too much pickle.", ["Boil and peel the potatoes", "Knead the atta and rest it 20 min"], "Golden spots on both sides; the filling reaches the edges.", [["potatoes", "three medium", "≈ 450 g"], ["atta", "two katoris", "≈ 2 cups"], ["green chilli", "one, chopped", ""], ["coriander", "a handful", ""], ["amchur", "a pinch", "≈ ½ tsp"], ["ghee", "for the tawa", ""]], [["Mash the potatoes with chilli, coriander, amchur and salt.", "No lumps, or it tears."], ["Stuff a ball of dough, seal it and roll gently.", ""], ["Cook on a hot tawa with ghee till spotted on both sides.", "Press the edges with the cloth."]], 24);
  R("recipe-arjun-palak", "arjun", "Palak paneer", "main", 15, 25, "3", "The first dish I learned to cook in New York, on a phone call with Maa.", ["Blanch the spinach 2 min, then into ice water", "Cube the paneer and soak in warm water"], "Bright green, never army green; paneer soft enough to cut with a spoon.", [["spinach", "", "2 bunches ≈ 400 g"], ["paneer", "", "200 g"], ["onion", "", "1 medium"], ["tomato", "", "1"], ["ginger, garlic", "", "1 tbsp paste"], ["cream", "", "2 tbsp"], ["garam masala", "", "½ tsp"]], [["Blend the blanched spinach smooth.", ""], ["Cook onion, ginger-garlic and tomato till the oil separates.", "Maa: wait for the oil, always."], ["Add the spinach, salt and garam masala; simmer 5 min.", "Not longer, it loses the colour."], ["Add paneer and cream, warm through.", ""]], 12);
  R("recipe-arjun-chai", "arjun", "Office-day masala chai", "drink", 2, 6, "2 cups", "What I make when it's 6 am here and evening in Kanpur, while we talk.", ["Crush 2 cardamom and a little ginger"], "The colour of a terracotta pot.", [["water", "", "1 cup"], ["milk", "", "1 cup"], ["tea leaves", "", "2 tsp"], ["ginger", "", "1 cm"], ["cardamom", "", "2 pods"], ["sugar", "", "to taste"]], [["Boil water with ginger and cardamom.", ""], ["Add tea, then milk; let it rise twice.", ""], ["Strain and sweeten.", ""]], 8);
  R("recipe-priya-bread", "priya", "Banana walnut bread", "sweet", 15, 55, "1 loaf", "Leo's birthday breakfast every year.", ["Mash 3 very ripe bananas", "Toast the walnuts"], "A skewer comes out clean; the top cracks down the middle.", [["ripe bananas", "", "3"], ["flour", "", "1½ cups"], ["butter, melted", "", "⅓ cup"], ["brown sugar", "", "½ cup"], ["egg", "", "1"], ["baking soda", "", "1 tsp"], ["walnuts", "", "½ cup"]], [["Mix banana, butter, sugar and egg.", ""], ["Fold in flour, soda, a pinch of salt and walnuts.", "Don't over-mix."], ["Bake at 175 °C for about 55 minutes.", ""]], 40);
  R("recipe-kavya-upma", "kavya", "Rava upma", "breakfast", 5, 15, "2", "Bangalore mornings before the office cab.", ["Dry-roast the rava till it smells nutty"], "Soft and fluffy, every grain separate.", [["rava", "", "1 cup"], ["water", "", "2½ cups"], ["mustard seeds, urad dal", "", "1 tsp each"], ["curry leaves", "", "a sprig"], ["green chilli", "", "1"], ["ghee", "", "1 tbsp"]], [["Temper mustard, dal, curry leaves and chilli in ghee.", ""], ["Add water and salt; bring to a boil.", ""], ["Rain in the rava, stirring, cover for 2 minutes.", "Stir fast or it lumps."]], 18);

  // ---------- Kitchen ----------
  seedDoc(FAM, "recipe", {
    id: "recipe-dadi-dal",
    title: "Dal tadka",
    course: "main",
    prepMins: 10,
    cookMins: 30,
    prepWork: ["Wash the dal three times", "Chop onion, tomato, ginger and garlic"],
    outcome: "Thick enough to coat a spoon; it smells of ghee from the next room.",
    cookId: "dadi",
    voiceCardId: "demo-recipe-dal",
    coverRef: null,
    memory: "Every Sunday after the market, before anyone was allowed lunch.",
    serves: "4, or 3 if Arjun is home",
    ingredients: [
      { item: "toor dal", said: "one katori", approx: "about 1 cup" },
      { item: "water", said: "two katoris", approx: "about 2 cups" },
      { item: "turmeric", said: "a little", approx: "about ½ tsp" },
      { item: "salt", said: "a little", approx: "to taste" },
      { item: "ghee", said: "for the tadka, and a little more on top", approx: "about 2 tbsp" },
      { item: "cumin (jeera)", said: "", approx: "about 1 tsp" },
      { item: "hing", said: "a pinch", approx: "" },
      { item: "onion", said: "", approx: "1 medium" },
      { item: "tomato", said: "", approx: "1 medium" },
      { item: "ginger, garlic", said: "", approx: "" },
    ],
    steps: [
      { text: "Wash the dal three times.", tip: "" },
      { text: "Pressure-cook it with the water, turmeric and salt for three whistles.", tip: "" },
      { text: "Heat ghee, add the jeera, and add hing once it starts to crackle.", tip: "" },
      { text: "Fry the onion slowly.", tip: "Don't rush the onions." },
      { text: "Add tomato, ginger and garlic, then the dal.", tip: "" },
      { text: "Finish with a little more ghee on top.", tip: "" },
    ],
    lang: "en",
    madeBy: "muse",
    createdAt: "2026-10-25T07:45:00.000Z",
  });
  seedDoc(FAM, "attempt", {
    id: "cooked-leo-dal",
    recipeId: "recipe-dadi-dal",
    memberId: "leo",
    photoRef: "/demo/family-leo.webp",
    note: "Too much salt. Dad still finished the bowl.",
    blessedBy: ["dadi"],
    createdAt: ago(60 * 26, now),
  });
  seedDoc(FAM, "attempt", {
    id: "cooked-arjun-dal",
    recipeId: "recipe-dadi-dal",
    memberId: "arjun",
    photoRef: null,
    note: "Tastes like Sunday. Almost.",
    blessedBy: [],
    createdAt: ago(60 * 5, now),
  });

  // ---------- Dadi's day (presence), on *her* clock ----------
  // Her everyday rhythm in India. Only moments already past in her day are
  // shared; before 6 AM there, the demo shows the day that just ended.
  const tz = "Asia/Kolkata";
  const day: [string, number, string][] = [
    ["awake", 6.15, ""],
    ["chai", 6.65, "On the verandah"],
    ["walk", 7.5, "Round the park with Mrs. Kapoor"],
    ["prayer", 9, ""],
    ["market", 11, "Bought methi, it was fresh"],
    ["cooking", 12.75, "Making kadhi"],
    ["resting", 14.5, ""],
    ["chai", 17.5, "Evening chai with Sunita didi"],
    ["visitors", 19, "The Kapoors came over"],
    ["resting", 21.75, "Good night"],
  ];
  const localNow = hourIn(tz, new Date(now)); // India is +5:30: minutes matter
  const shift = localNow < 6 ? 24 : 0; // before dawn: show yesterday
  day
    .filter(([, h]) => h <= localNow + shift)
    .forEach(([moment, h, note], i) => seedDoc(FAM, "presence", { id: `presence-dadi-${i}`, memberId: "dadi", moment, note, at: ago(Math.round((localNow + shift - h) * 60), now) }));
  const dadaDay: [string, number, string][] = [
    ["walk", 7.5, "With Dadi, round the park"],
    ["market", 10.25, "Newspaper and milk"],
    ["garden", 16.5, "The tulsi needs water"],
    ["resting", 22, ""],
  ];
  dadaDay
    .filter(([, h]) => h <= localNow + shift)
    .forEach(([moment, h, note], i) => seedDoc(FAM, "presence", { id: `presence-dada-${i}`, memberId: "dada", moment, note, at: ago(Math.round((localNow + shift - h) * 60), now) }));
  seedDoc(FAM, "presence", { id: "presence-arjun-0", memberId: "arjun", moment: "thinking", note: "", at: ago(15, now) });
  seedDoc(FAM, "care_settings", { id: "dadi", memberId: "dadi", quietAlert: true, tellMemberId: "arjun", graceHours: 3, updatedAt: ago(60 * 24 * 6, now) });

  // ---------- Dadi's Village ----------
  const village = [
    { id: "helper-ramesh", name: "Ramesh", role: "groceries", phone: "+91 90000 00001", note: "Kirana at the corner. Delivers before 11." },
    { id: "helper-sunita", name: "Sunita didi", role: "house help", phone: "+91 90000 00002", note: "Mornings, Monday to Saturday." },
    { id: "helper-imran", name: "Imran bhai", role: "driver", phone: "+91 90000 00003", note: "Knows the way to the temple and the clinic." },
    { id: "helper-kapoor", name: "Mrs. Kapoor", role: "neighbour", phone: "+91 90000 00004", note: "Next door. Walks with Dadi most mornings." },
    { id: "helper-gas", name: "Gas agency", role: "gas booking", phone: "+91 90000 00005", note: "Booking ID is in the kitchen drawer." },
  ];
  village.forEach((h) => seedDoc(FAM, "helper", { ...h, forMemberId: "dadi", addedBy: "arjun", createdAt: ago(60 * 24 * 20, now) }));
  seedDoc(FAM, "helper", { id: "helper-dr-clinic", name: "Sharma Clinic", role: "doctor's clinic", forMemberId: "dada", phone: "+91 90000 00006", note: "Dada's regular check-ups. Imran bhai drives.", addedBy: "arjun", createdAt: ago(60 * 24 * 20, now) });

  // ---------- Pets ----------
  seedDoc(FAM, "pet", { id: "pet-bruno", name: "Bruno", species: "dog", livesWith: "dadi", photoRef: null, birthday: "02-14", note: "Waits at the gate for the milkman.", addedBy: "arjun", createdAt: ago(60 * 24 * 40, now) });
  seedDoc(FAM, "pet", { id: "pet-mochi", name: "Mochi", species: "cat", livesWith: "arjun", photoRef: null, birthday: "", note: "Sleeps on Leo's homework.", addedBy: "leo", createdAt: ago(60 * 24 * 30, now) });

  // ---------- Safe & sound (Aria, at college in Chicago, chose Papa and Dadi) ----------
  seedDoc(FAM, "safety_settings", { id: "aria", memberId: "aria", enabled: true, watchers: ["arjun", "dadi"], paused: false, updatedAt: ago(60 * 24 * 6, now) });
  seedDoc(FAM, "safety_checkin", { id: "safe-aria-1", memberId: "aria", kind: "heading", note: "From the library", etaAt: ago(60 * 26 - 25, now), closedAt: ago(60 * 26 - 22, now), location: null, at: ago(60 * 26, now) });
  seedDoc(FAM, "safety_checkin", { id: "safe-aria-2", memberId: "aria", kind: "home-safe", note: "", etaAt: null, closedAt: ago(140, now), location: null, at: ago(140, now) });

  // ---------- Care circle ----------
  seedDoc(FAM, "need", {
    id: "need-gas",
    forMemberId: "dadi",
    askedBy: "dadi",
    title: "The gas cylinder is almost empty",
    kind: "gas",
    when: "This week",
    status: "claimed",
    claimedBy: "arjun",
    helperId: "helper-gas",
    noteForParent: "अर्जुन ने बुक कर दिया है। गैस एजेंसी गुरुवार को सिलेंडर पहुँचा देगी।",
    doneAt: null,
    createdAt: ago(60 * 20, now),
  });
  seedDoc(FAM, "need", {
    id: "need-veg",
    forMemberId: "dadi",
    askedBy: "dadi",
    title: "Vegetables and milk for the week",
    kind: "groceries",
    when: "Tomorrow morning",
    status: "open",
    claimedBy: null,
    helperId: null,
    noteForParent: "",
    doneAt: null,
    createdAt: ago(90, now),
  });
  seedDoc(FAM, "need", {
    id: "need-ride",
    forMemberId: "dadi",
    askedBy: "arjun",
    title: "A ride to the temple fair",
    kind: "ride",
    when: "Saturday, 5 PM",
    status: "done",
    claimedBy: "arjun",
    helperId: "helper-imran",
    noteForParent: "इमरान भाई आपको ले गए थे। अर्जुन ने इंतज़ाम किया था।",
    doneAt: ago(60 * 24 * 3, now),
    createdAt: ago(60 * 24 * 5, now),
  });
  seedDoc(FAM, "rota", { id: "dadi", forMemberId: "dadi", order: ["arjun", "leo"], startWeek: "2026-10-26", updatedAt: ago(60 * 24 * 3, now) });

  // ---------- Sit together ----------
  seedDoc(FAM, "sitting", {
    id: "sit-dal",
    reason: "cook",
    title: "Cook Dadi's dal together",
    hostId: "leo",
    startsAt: nextLocal(0, 19, "Asia/Kolkata", now),
    invites: ["dadi", "arjun", "aria"],
    recipeId: "recipe-dadi-dal",
    note: "Dadi watches, we cook. Bring your own onions.",
    keptCardId: null,
    createdAt: ago(60 * 30, now),
  });
  if (localNow >= 7 && localNow < 21.5) {
    const note = localNow < 12 ? "Morning chai on the verandah. Come sit?" : localNow < 17 ? "Shelling peas. Come sit with me?" : "Evening chai. Come sit?";
    seedDoc(FAM, "knock", { id: "knock-dadi", memberId: "dadi", note, at: ago(10, now), until: ahead(50, now) });
  }

  // ---------- The weekly question ----------
  seedDoc(FAM, "question", {
    id: "q-dadi-week",
    toMemberId: "dadi",
    text: "What did your mother cook when someone came home after a long journey?",
    askedBy: null,
    topic: "recipe",
    answeredCardId: null,
    madeBy: "muse",
    createdAt: ago(60 * 24 * 2, now),
  });
  seedDoc(FAM, "question", {
    id: "q-leo-paratha",
    toMemberId: "dadi",
    text: "How do you make your aloo paratha?",
    askedBy: "leo",
    topic: "recipe",
    answeredCardId: null,
    madeBy: "family",
    createdAt: ago(60 * 6, now),
  });

  // ---------- What Muse did this week (sample activity for the demo) ----------
  const calls: [string, number, number, boolean][] = [
    ["Wrote up Dadi's recipe from a voice note", 60 * 24 * 3, 2140, false],
    ["Translated \"Dadi's dal tadka\" for a reader in English", 60 * 24 * 3 - 5, 980, false],
    ["Asked Dadi this week's question", 60 * 24 * 2, 760, false],
    ["Wrote a note for Dadi in Hindi: the gas booking", 60 * 20, 640, false],
    ["Transcribed Arjun's voice note", 60 * 6, 1830, false],
    ["Translated Dadi's blessing for Leo", 60 * 5, 0, true],
  ];
  calls.forEach(([purpose, mins, ms, cached], i) =>
    seedDoc(FAM, "muse_call", { id: `muse-demo-${i}`, purpose, model: purpose.startsWith("Transcribed") ? "muse-voice-transcribe-1.0" : "muse-spark-1.3", cached, ok: true, ms, cost: cached ? 0 : 0.01, at: ago(mins, now) }),
  );
}
