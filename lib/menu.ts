// Every feature since PR #1, in five rooms of a house (SPEC §29.3). A room
// opens to the spaces inside it; a room that is one place (Kitchen) opens
// directly. Each item opens its own page: no two items in a room share one.
// Safe & sound is not here: it lives on the window, the first screen.
// Settings is not here either: tap your own photo.

export interface MenuItem {
  href: string;
  title: string;
  note: string;
  icon: string;
}
export interface Room {
  id: "memories" | "kitchen" | "care" | "family" | "sit";
  title: string;
  /** One line under the tile: what's in this room. */
  note: string;
  icon: string;
  /** Tile tint: [light, deep]. From the approved palette. */
  tone: [string, string];
  /** A room that is one place opens it directly; otherwise its spaces show in a sheet. */
  href?: string;
  items: MenuItem[];
}

export function roomsFor(isParent: boolean, _parentNames = ""): Room[] {
  void _parentNames;
  return [
    {
      id: "memories",
      title: "Memories",
      note: "Photos, occasions, stories",
      icon: "memories",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/lane", title: "Memory Lane", note: "Every photo and voice, by the years; albums Muse sorts", icon: "lane" },
        { href: "/rituals", title: "Occasions", note: "Birthdays and festivals; wishes and photos from every home", icon: "calendar" },
        { href: "/stories", title: "Stories", note: "For the children, in their grandparents' voices", icon: "moon" },
      ],
    },
    {
      id: "kitchen",
      title: "Kitchen",
      note: "Recipes, in the voice that taught them",
      icon: "pot",
      tone: ["#f1f0ee", "#1c1b1a"],
      href: "/kitchen",
      items: [{ href: "/kitchen", title: "Recipes", note: isParent ? "Your recipes, and who cooked them" : "In the voice that taught them", icon: "pot" }],
    },
    {
      id: "care",
      title: "Care",
      note: "Help at home, people nearby",
      icon: "care",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/care", title: isParent ? "Ask for help" : "Care tasks", note: "Say it, add it, pick it up", icon: "care" },
        { href: "/care/helpers", title: "Local helpers", note: "Grocer, driver, house help, the plumber", icon: "village" },
        { href: "/nearby", title: "Trusted nearby", note: "Your top 5 to call first, in order", icon: "gather" },
        { href: "/send", title: "Send something", note: "Groceries, a cake, a gift: Muse suggests, you send", icon: "send" },
      ],
    },
    {
      id: "family",
      title: "Family",
      note: "Tree, the Book, advice",
      icon: "tree",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/bond", title: "Family tree", note: "Every generation, both sides, home by home", icon: "tree" },
        { href: "/book", title: "The Book", note: "Their life, chapter by chapter, in their own voice", icon: "book" },
        { href: "/advice", title: "Advice, tips & blessings", note: "Life lessons and kitchen tricks, kept with the question", icon: "bless" },
        { href: "/portrait", title: "Family portrait", note: "Muse paints all of you, from your own photos", icon: "sparkle" },
        { href: "/settings#invite", title: "Invite family", note: "A sibling, a cousin, your in-laws", icon: "plus" },
      ],
    },
    {
      id: "sit",
      title: "Gathering",
      note: "Calls, visits, holidays, play",
      icon: "video",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/gather", title: "Plan a gathering", note: "A family call with a reason", icon: "video" },
        { href: "/together/visits", title: "Visits", note: "A visit home: dates, tickets, a countdown", icon: "village" },
        { href: "/together/holidays", title: "Family holidays", note: "Somewhere together, with a countdown", icon: "send" },
        { href: "/gather/play", title: "Play together", note: "Something to do on a call, right now", icon: "sparkle" },
      ],
    },
  ];
}
