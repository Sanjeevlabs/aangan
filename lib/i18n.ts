// Demo languages: English + Hindi. UI chrome is English-first; the viewer's
// language drives greetings, kinship-driven lines, and card content.
// Add locales here, never branch logic on them.

export const SUPPORTED_LANGS = ["en", "hi"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export function normalizeLang(lang: string | null | undefined): SupportedLang {
  return lang === "hi" ? "hi" : "en";
}

export type DayPart = "morning" | "afternoon" | "evening";

export function greetingForHour(hour: number): DayPart {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

interface Strings {
  tabs: { home: string; lane: string; add: string; rituals: string; gather: string };
  greeting: Record<DayPart, string>;
  welcomeTo: (name: string) => string;
  changeHome: string;
  stepInside: string;
  addHomeTitle: string;
  addHomeHint: string;
  shelves: {
    role: string;
    fromElder: (name: string) => string;
    voices: string;
    today: string;
    yearsAgo: string;
    comingUp: string;
    record: string;
  };
  add: {
    title: string;
    photos: string;
    voice: string;
    video: string;
    ask: string;
    fromToday: string;
    fromGlasses: string;
    captionPlaceholder: string;
    share: string;
    processing: string;
    voiceSoon: string;
    askSoon: string;
  };
  card: { untitled: string; glassesBadge: string };
  coming: { inDays: (n: number) => string; today: string; birthday: (name: string) => string };
  empty: { laneSoon: string; ritualsSoon: string; gatherSoon: string; noToday: string };
  viewingAs: string;
  common: { cancel: string; close: string; retry: string };
}

const STRINGS: Record<SupportedLang, Strings> = {
  en: {
    tabs: { home: "Home", lane: "Lane", add: "Add", rituals: "Rituals", gather: "Gather" },
    greeting: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    welcomeTo: (name) => `Welcome to ${name}'s Aangan`,
    changeHome: "Change home",
    stepInside: "Step inside",
    addHomeTitle: "Add a photo of the home you miss",
    addHomeHint: "A courtyard, a window, a doorway — avoid house numbers or street signs.",
    shelves: {
      role: "Today's role",
      fromElder: (name) => `From ${name}`,
      voices: "Voices",
      today: "Today · add from your day",
      yearsAgo: "This day, years ago",
      comingUp: "Coming up",
      record: "Record for them",
    },
    add: {
      title: "Add to today",
      photos: "Photos",
      voice: "Voice",
      video: "Video",
      ask: "Ask",
      fromToday: "From today",
      fromGlasses: "From my glasses",
      captionPlaceholder: "Say something about this moment…",
      share: "Add memory",
      processing: "Preparing…",
      voiceSoon: "Voice recording arrives in M2 — the Heard loop needs it first.",
      askSoon: "Suggested questions arrive with voice in M2. These starters work today:",
    },
    card: { untitled: "A family memory", glassesBadge: "Captured hands-free" },
    coming: {
      inDays: (n) => (n === 1 ? "tomorrow" : `in ${n} days`),
      today: "Today!",
      birthday: (name) => `${name}'s birthday`,
    },
    empty: {
      laneSoon: "Memory Lane arrives in M3.",
      ritualsSoon: "The Rituals calendar arrives in M4.",
      gatherSoon: "Gather arrives in M5.",
      noToday: "Nothing from today yet — add the first moment.",
    },
    viewingAs: "Viewing as",
    common: { cancel: "Cancel", close: "Close", retry: "Try again" },
  },
  hi: {
    tabs: { home: "होम", lane: "लेन", add: "जोड़ें", rituals: "रस्में", gather: "मिलन" },
    greeting: { morning: "सुप्रभात", afternoon: "नमस्ते", evening: "शुभ संध्या" },
    welcomeTo: (name) => `${name} के आँगन में स्वागत है`,
    changeHome: "घर बदलें",
    stepInside: "अंदर चलें",
    addHomeTitle: "उस घर की फ़ोटो जोड़ें जिसकी याद आती है",
    addHomeHint: "आँगन, खिड़की, दरवाज़ा — मकान नंबर या गली का नाम न दिखे।",
    shelves: {
      role: "आज की भूमिका",
      fromElder: (name) => `${name} की ओर से`,
      voices: "आवाज़ें",
      today: "आज · अपने दिन से जोड़ें",
      yearsAgo: "आज ही के दिन, सालों पहले",
      comingUp: "आने वाला",
      record: "उनके लिए रिकॉर्ड करें",
    },
    add: {
      title: "आज में जोड़ें",
      photos: "फ़ोटो",
      voice: "आवाज़",
      video: "वीडियो",
      ask: "पूछें",
      fromToday: "आज की",
      fromGlasses: "मेरे चश्मे से",
      captionPlaceholder: "इस पल के बारे में कुछ कहें…",
      share: "याद जोड़ें",
      processing: "तैयार हो रहा है…",
      voiceSoon: "आवाज़ रिकॉर्डिंग M2 में आएगी — पहले हर्ड लूप ज़रूरी है।",
      askSoon: "सुझाए गए सवाल M2 में आवाज़ के साथ आएँगे। ये शुरुआत आज काम करेगी:",
    },
    card: { untitled: "परिवार की एक याद", glassesBadge: "हैंड्स-फ़्री कैप्चर" },
    coming: {
      inDays: (n) => (n === 1 ? "कल" : `${n} दिन में`),
      today: "आज!",
      birthday: (name) => `${name} का जन्मदिन`,
    },
    empty: {
      laneSoon: "मेमोरी लेन M3 में आएगी।",
      ritualsSoon: "रस्मों का कैलेंडर M4 में आएगा।",
      gatherSoon: "मिलन M5 में आएगा।",
      noToday: "आज की कोई याद नहीं — पहला पल जोड़ें।",
    },
    viewingAs: "इस रूप में देखें",
    common: { cancel: "रद्द करें", close: "बंद करें", retry: "फिर कोशिश करें" },
  },
};

export function strings(lang: string | null | undefined): Strings {
  return STRINGS[normalizeLang(lang)];
}

// Static starter questions (data, not model output). Model-suggested prompts
// arrive in M2 with the voice stack.
export const ASK_STARTERS: Record<SupportedLang, string[]> = {
  en: [
    "What did your courtyard look like as a child?",
    "Teach me one word I should never forget.",
    "What song did your mother sing to you?",
  ],
  hi: [
    "बचपन में आपका आँगन कैसा दिखता था?",
    "मुझे एक ऐसा शब्द सिखाइए जो मैं कभी न भूलूँ।",
    "आपकी माँ आपको कौन-सा गीत सुनाती थीं?",
  ],
};
