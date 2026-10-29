import type { Member } from "./schemas";

// Demo family (synthetic seed data; the viewer cycles between members).
// Kinship titles here are data (what the family calls each person), not logic —
// the viewer-relative kinship resolver lands in M3.
export interface DemoFamily {
  id: string;
  name: string;
  defaultHomeImageRef: string | null;
}

export const DEMO_FAMILY: DemoFamily = {
  id: "demo-family",
  name: "Sharma",
  defaultHomeImageRef: null,
};

export const DEMO_MEMBERS: Member[] = [
  {
    id: "dadi",
    access: "member",
    personId: null,
    photoRef: "/demo/portrait-dadi.webp",
    email: null,
    familyId: "demo-family",
    firstName: "Dadi",
    displayName: "Dadi",
    role: "elder",
    lang: "hi",
    displayLang: "hi-deva",
    tz: "Asia/Kolkata",
    birthday: "01-22",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "dada",
    access: "member",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Mohan",
    displayName: "Dada",
    role: "elder",
    lang: "hi",
    displayLang: "hi-deva",
    tz: "Asia/Kolkata",
    birthday: "08-15",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "arjun",
    access: "admin",
    personId: "p-arjun",
    photoRef: "/demo/portrait-dad.webp",
    email: null,
    familyId: "demo-family",
    firstName: "Arjun",
    displayName: "Dad",
    role: "adult",
    lang: "en",
    displayLang: "en",
    tz: "America/New_York",
    birthday: "07-30",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "leo",
    access: "member",
    personId: "p-leo",
    photoRef: "/demo/portrait-leo.webp",
    email: null,
    familyId: "demo-family",
    firstName: "Leo",
    displayName: "Leo",
    role: "child",
    lang: "en",
    displayLang: "en",
    tz: "America/New_York",
    birthday: "11-09",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "aria",
    access: "child",
    personId: "p-aria",
    photoRef: "/demo/portrait-aria.webp",
    email: null,
    familyId: "demo-family",
    firstName: "Aria",
    displayName: "Aria",
    role: "child",
    lang: "en",
    displayLang: "hi-latn",
    tz: "America/Chicago",
    birthday: "03-14",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "priya",
    access: "member",
    personId: "p-priya",
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Priya",
    displayName: "Mom",
    role: "adult",
    lang: "en",
    displayLang: "en",
    tz: "America/New_York",
    birthday: "05-02",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "kavya",
    access: "member",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Kavya",
    displayName: "Bua",
    role: "adult",
    lang: "hi",
    displayLang: "en",
    tz: "Asia/Kolkata",
    birthday: "09-19",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "rahul",
    access: "member",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Rahul",
    displayName: "Fufa",
    role: "adult",
    lang: "en",
    displayLang: "en",
    tz: "Asia/Kolkata",
    birthday: "12-03",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "anaya",
    access: "child",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Anaya",
    displayName: "Anaya",
    role: "child",
    lang: "en",
    displayLang: "en",
    tz: "Asia/Kolkata",
    birthday: "06-25",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "rohan",
    access: "member",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Rohan",
    displayName: "Chachu",
    role: "adult",
    lang: "en",
    displayLang: "en",
    tz: "Europe/London",
    birthday: "03-14",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "sneha",
    access: "member",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Sneha",
    displayName: "Chachi",
    role: "adult",
    lang: "en",
    displayLang: "en",
    tz: "Europe/London",
    birthday: "08-30",
    homeImageRef: null,
    homePalette: [],
  },
  {
    id: "kabir",
    access: "child",
    personId: null,
    photoRef: null,
    email: null,
    familyId: "demo-family",
    firstName: "Kabir",
    displayName: "Kabir",
    role: "child",
    lang: "en",
    displayLang: "en",
    tz: "Europe/London",
    birthday: "11-21",
    homeImageRef: null,
    homePalette: [],
  },
];

export const DEMO_IYER: DemoFamily = { id: "demo-iyer", name: "Iyer", defaultHomeImageRef: null };

// Priya's side: her parents in Chennai, her brother's family in Pune. Priya,
// Arjun and the children belong here too (same personId as on the Sharma side).
const iyer = (id: string, firstName: string, displayName: string, role: Member["role"], access: Member["access"], tz: string, birthday: string, personId: string | null = null, photoRef: string | null = null, lang = "en", displayLang: Member["displayLang"] = "en"): Member => ({
  id,
  access,
  personId,
  photoRef,
  email: null,
  familyId: "demo-iyer",
  firstName,
  displayName,
  role,
  lang,
  displayLang,
  tz,
  birthday,
  homeImageRef: null,
  homePalette: [],
});

export const DEMO_IYER_MEMBERS: Member[] = [
  iyer("iyer-priya", "Priya", "Mom", "adult", "admin", "America/New_York", "05-02", "p-priya"),
  iyer("iyer-arjun", "Arjun", "Dad", "adult", "member", "America/New_York", "07-30", "p-arjun", "/demo/portrait-dad.webp"),
  iyer("iyer-leo", "Leo", "Leo", "child", "child", "America/New_York", "11-09", "p-leo", "/demo/portrait-leo.webp"),
  iyer("iyer-aria", "Aria", "Aria", "child", "child", "America/New_York", "03-14", "p-aria", "/demo/portrait-aria.webp"),
  iyer("iyer-nani", "Lakshmi", "Nani", "elder", "member", "Asia/Kolkata", "02-11", null, null, "ta", "ta"),
  iyer("iyer-nana", "Venkat", "Nana", "elder", "member", "Asia/Kolkata", "09-05", null, null, "ta", "ta"),
  iyer("iyer-karthik", "Karthik", "Mama", "adult", "member", "Asia/Kolkata", "01-27"),
  iyer("iyer-meera", "Meera", "Mami", "adult", "member", "Asia/Kolkata", "06-08"),
  iyer("iyer-diya", "Diya", "Diya", "child", "child", "Asia/Kolkata", "10-02"),
];

/** Demo Aangans: the synthetic families the demo invite code opens. */
export const DEMO_FAMILY_IDS = ["demo-family", "demo-iyer"] as const;

export const DEFAULT_VIEWER_ID = "leo";

// Signal + role lines per viewer display_lang (data, not logic).
// en, hi-latn (Latin script), hi-deva (Devanagari).
export const MOCK_SIGNAL_LINES: Record<string, string> = {
  dadi: "Leo sent you a voice note · Aria asked a question",
  arjun: "Dadi heard your voice note · 2 new blessings",
  leo: "Dadi heard your voice note · 2 new blessings",
  aria: "Dadi blessed your drawing · 1 new voice note",
};

export const SIGNAL_LINES_BY_LANG: Record<string, Record<string, string>> = {
  en: {
    dadi: "Leo sent you a voice note · Aria asked a question",
    arjun: "Grandma heard your voice note · 2 new blessings",
    leo: "Grandma heard your voice note · 2 new blessings",
    aria: "Grandma blessed your drawing · 1 new voice note",
  },
  "hi-latn": {
    dadi: "Leo ne aapko voice note bheja · Aria ne sawal poocha",
    arjun: "Dadi ne aapka voice note suna · 2 naye aashirvaad",
    leo: "Dadi ne aapka voice note suna · 2 naye aashirvaad",
    aria: "Dadi ne aapki drawing par aashirvaad diya · 1 naya voice note",
  },
  "hi-deva": {
    dadi: "लियो ने आपको वॉइस नोट भेजा · आरिया ने सवाल पूछा",
    arjun: "दादी ने आपका वॉइस नोट सुना · 2 नए आशीर्वाद",
    leo: "दादी ने आपका वॉइस नोट सुना · 2 नए आशीर्वाद",
    aria: "दादी ने आपकी ड्राइंग पर आशीर्वाद दिया · 1 नया वॉइस नोट",
  },
};

// MOCK until M4: daily roles are generated by the ritual agent in M4.
export const MOCK_DAILY_ROLES: Record<string, string> = {
  dadi: "Today: teach Aria one word",
};

export const DAILY_ROLES_BY_LANG: Record<string, string> = {
  en: "Today: teach Aria one word",
  "hi-latn": "Aaj: Aria ko ek shabd sikhao",
  "hi-deva": "आज: आरिया को एक शब्द सिखाओ",
};

export function signalLineFor(viewerId: string, displayLang: string): string {
  return (
    SIGNAL_LINES_BY_LANG[displayLang]?.[viewerId] ??
    MOCK_SIGNAL_LINES[viewerId] ??
    // Real families get no invented signal; the demo family's lines are seeded.
    ""
  );
}

export function dailyRoleFor(displayLang: string): string {
  return DAILY_ROLES_BY_LANG[displayLang] ?? DAILY_ROLES_BY_LANG.en;
}

// Days from `now` until the next MM-DD birthday. Pure and data-driven.
/** Days until the next birthday; Infinity when no birthday has been added. */
export function daysUntilBirthday(mmdd: string, now = new Date()): number {
  if (!/^\d{2}-\d{2}$/.test(mmdd)) return Number.POSITIVE_INFINITY;
  const [m, d] = mmdd.split("-").map(Number);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let next = new Date(Date.UTC(now.getUTCFullYear(), m - 1, d));
  if (next < start) next = new Date(Date.UTC(now.getUTCFullYear() + 1, m - 1, d));
  return Math.round((next.getTime() - start.getTime()) / 86400000);
}
