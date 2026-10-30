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
      tone: ["#fde8d7", "#b8572b"],
      items: [
        { href: "/lane", title: "Memory Lane", note: "Every photo and voice, by the years; albums Muse sorts", icon: "lane" },
        { href: "/rituals", title: "Occasions", note: "Birthdays and festivals; wishes and photos from every home", icon: "calendar" },
        { href: "/reel", title: "Year's reel", note: "A film of the family's year, made from what you kept", icon: "sparkle" },
      ],
    },
    {
      id: "kitchen",
      title: "Kitchen",
      note: "Recipes, stories, blessings",
      icon: "pot",
      tone: ["#fff1cf", "#9a6a12"],
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
      tone: ["#e3f1e7", "#2f7a4c"],
      items: [
        { href: "/care", title: isParent ? "Ask for help" : "Care board", note: "Groceries, repairs, rides; who's on it", icon: "care" },
        { href: "/care#helpers", title: "Local helpers", note: "Grocer, driver, house help, the plumber", icon: "village" },
        { href: "/nearby", title: "Trusted nearby", note: "For each home, who's close by to call first", icon: "gather" },
        { href: "/safe", title: "Safe & sound", note: "Heading home, landed, I need help", icon: "shield" },
        ...(isParent ? [] : [{ href: "/around", title: "Around their home", note: "Places near them, with your memories", icon: "pin" }]),
      ],
    },
    {
      id: "family",
      title: "Family",
      note: "Tree, both sides, visits",
      icon: "tree",
      tone: ["#e6ebf6", "#34508a"],
      items: [
        { href: "/bond", title: "Family tree", note: "Every generation, both sides, home by home", icon: "tree" },
        { href: "/together", title: "Visits", note: "Who's coming home; a countdown both homes see", icon: "send" },
        { href: "/settings#invite", title: "Invite family", note: "A sibling, a cousin, your in-laws", icon: "plus" },
      ],
    },
    {
      id: "sit",
      title: "Get-together",
      note: "Chai, story night, a festival",
      icon: "video",
      tone: ["#dff3e8", "#1f7a4a"],
      href: "/gather",
      items: [{ href: "/gather", title: "Plan a get-together", note: "Chai, story night, a festival: a call with a reason", icon: "video" }],
    },
  ];
}
