// Kutumb (SPEC §29.3): every feature since PR #1, in five rooms of a house
// rather than a menu. A room opens to the spaces inside it; Get-together is
// one place, so it opens directly.

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
      note: "Photos, voices, occasions",
      icon: "memories",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/lane", title: "Memory Lane", note: "Every photo and voice, by the years; albums Muse sorts", icon: "lane" },
        { href: "/rituals", title: "Occasions", note: "Birthdays and festivals; wishes and photos from every home", icon: "calendar" },
        { href: "/book", title: "The Book", note: "Their life, chapter by chapter, in their own voice", icon: "book" },
        { href: "/reel", title: "Year's reel", note: "A film of the family's year, made from what you kept", icon: "sparkle" },
      ],
    },
    {
      id: "kitchen",
      title: "Kitchen",
      note: "Recipes, stories, blessings",
      icon: "pot",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/kitchen", title: "Recipes", note: isParent ? "Your recipes, and who cooked them" : "In the voice that taught them", icon: "pot" },
        { href: "/stories", title: "Stories", note: "For the children, in their grandparents' voices", icon: "moon" },
        { href: "/advice", title: "Advice, tips & blessings", note: "Life lessons and kitchen tricks, kept with the question", icon: "bless" },
      ],
    },
    {
      id: "care",
      title: "Care",
      note: "Help at home, people nearby",
      icon: "care",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/care", title: isParent ? "Ask for help" : "Care tasks", note: "Say it, add it, pick it up", icon: "care" },
        { href: "/care#helpers", title: "Local helpers", note: "Grocer, driver, house help, the plumber", icon: "village" },
        { href: "/nearby", title: "Trusted nearby", note: "Your top 5 to call first, in order", icon: "gather" },
        { href: "/send", title: "Send something", note: "Groceries, a cake, a gift: Muse suggests, you send", icon: "send" },
        { href: "/safe", title: "Safe & sound", note: "Heading home, landed, I need help", icon: "shield" },
      ],
    },
    {
      id: "family",
      title: "Family",
      note: "Tree, your families, visits",
      icon: "tree",
      tone: ["#f1f0ee", "#1c1b1a"],
      items: [
        { href: "/bond", title: "Family tree", note: "Every generation, both sides, home by home", icon: "tree" },
        { href: "/together", title: "Visits & holidays", note: "Plan a visit home or a family trip", icon: "send" },
        { href: "/settings#invite", title: "Invite family", note: "A sibling, a cousin, your in-laws", icon: "plus" },
      ],
    },
    {
      id: "sit",
      title: "Get-together",
      note: "Chai, story night, a festival",
      icon: "video",
      tone: ["#f1f0ee", "#1c1b1a"],
      href: "/gather",
      items: [{ href: "/gather", title: "Plan a get-together", note: "Chai, story night, a festival: a call with a reason", icon: "video" }],
    },
  ];
}
