// Family mode (SPEC §29.3): every feature since PR #1, in four rooms of a
// house rather than a menu. Each room opens to the spaces inside it. Sit
// together isn't a room: it's live, so it lives on the courtyard itself.

export interface MenuItem {
  href: string;
  title: string;
  note: string;
  icon: string;
}
export interface Room {
  id: "memories" | "library" | "care" | "family";
  title: string;
  /** One line under the tile: what's in this room. */
  note: string;
  icon: string;
  /** Tile tint: [light, deep]. From the approved palette. */
  tone: [string, string];
  items: MenuItem[];
}

export function roomsFor(isParent: boolean, parentNames: string): Room[] {
  const them = parentNames || "your parents";
  return [
    {
      id: "memories",
      title: "Memories",
      note: "Photos, voices, the years",
      icon: "memories",
      tone: ["#fde8d7", "#b8572b"],
      items: [
        { href: "/lane", title: "Memory Lane", note: "Every photo and voice, by the years; albums Muse sorts", icon: "lane" },
        { href: "/rituals", title: "Occasions", note: "Birthdays and festivals; wishes and photos from both homes", icon: "calendar" },
        { href: "/reel", title: "The year's reel", note: "A film of the family's year, made from what you kept", icon: "sparkle" },
      ],
    },
    {
      id: "library",
      title: isParent ? "What you've given" : "Their library",
      note: "Recipes, stories, advice, blessings",
      icon: "book",
      tone: ["#fff1cf", "#9a6a12"],
      items: [
        ...(isParent ? [] : [{ href: "/ask", title: `Ask ${them}`, note: "A recipe, a story, their advice or a blessing", icon: "reply" }]),
        { href: "/kitchen", title: "Kitchen", note: isParent ? "Your recipes, and who cooked them" : "Recipes in the voice that taught them", icon: "pot" },
        { href: "/stories", title: "Stories", note: "Told in the voices that tell them", icon: "moon" },
        { href: "/advice", title: "Advice & blessings", note: "Answers kept with the question", icon: "bless" },
      ],
    },
    {
      id: "care",
      title: "Care",
      note: isParent ? "Ask for help, home safe" : "Their home, their helpers",
      icon: "care",
      tone: ["#e3f1e7", "#2f7a4c"],
      items: [
        { href: "/care", title: isParent ? "Ask the family for help" : "Care board", note: "Groceries, repairs, rides; who's on it", icon: "care" },
        { href: "/care#helpers", title: "Local helpers", note: "The people near them who help", icon: "village" },
        { href: "/circle", title: "Local circle", note: "For each home, who's nearby to call first", icon: "gather" },
        { href: "/safe", title: "Safe & sound", note: "Home safe, heading home, I need help", icon: "shield" },
        ...(isParent ? [] : [{ href: "/around", title: "Around their home", note: "Places near them, with your memories", icon: "pin" }]),
        { href: "/together", title: isParent ? "Visits" : "Plan a visit", note: "Dates and a countdown both homes see", icon: "send" },
      ],
    },
    {
      id: "family",
      title: "Family",
      note: "Both sides, siblings, cousins",
      icon: "tree",
      tone: ["#e6ebf6", "#34508a"],
      items: [
        { href: "/bond", title: "Family tree", note: "Every generation, both sides, how we're related", icon: "tree" },
        { href: "/gather", title: "Sit together", note: "Plan a call with a reason: chai, a story, a festival", icon: "video" },
        { href: "/settings#invite", title: "Invite family", note: "Bring in a sibling, a cousin, your in-laws", icon: "plus" },
      ],
    },
  ];
}
