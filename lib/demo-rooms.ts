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
  // ---------- Kitchen ----------
  seedDoc(FAM, "recipe", {
    id: "recipe-dadi-dal",
    title: "Dadi's dal tadka",
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
