// Five spaces, one hero: the parent far away. Every space answers one of
// three questions (SPEC §28): what can we ask of them, what have they given,
// and how do we keep them able to give. Rooms show as tabs inside a space.

export interface Space {
  id: "home" | "ask" | "library" | "care" | "family";
  title: string;
  note: string;
  icon: string;
  href: string;
  rooms: { href: string; title: string }[];
  /** Hidden from the parent's own menu (they are the one being asked). */
  notForParents?: boolean;
}

export const SPACES: Space[] = [
  { id: "home", title: "Home", note: "Their day, and the latest voice", icon: "door", href: "/", rooms: [] },
  { id: "ask", title: "Ask", note: "A recipe, a story, their advice or a blessing", icon: "reply", href: "/ask", rooms: [], notForParents: true },
  {
    id: "library",
    title: "Library",
    note: "Everything they've given: recipes, stories, advice",
    icon: "pot",
    href: "/kitchen",
    rooms: [
      { href: "/kitchen", title: "Recipes" },
      { href: "/stories", title: "Stories" },
      { href: "/advice", title: "Advice & blessings" },
    ],
  },
  {
    id: "care",
    title: "Care",
    note: "Help at their home, local helpers, safe and sound",
    icon: "care",
    href: "/care",
    rooms: [
      { href: "/care", title: "Help at home" },
      { href: "/safe", title: "Safe & sound" },
    ],
  },
  {
    id: "family",
    title: "Family",
    note: "Everyone, both sides, visits and birthdays",
    icon: "tree",
    href: "/bond",
    rooms: [
      { href: "/bond", title: "Everyone" },
      { href: "/together", title: "Together" },
      { href: "/rituals", title: "Occasions" },
      { href: "/lane", title: "Memories" },
      { href: "/gather", title: "Sit together" },
    ],
  },
];

/** Notes in the parent's own words: the library is what *they* have given. */
const PARENT_NOTES: Partial<Record<Space["id"], string>> = {
  home: "What the family asked of you, and your day",
  library: "What you've given: recipes, stories, advice",
  care: "Ask for help; your local helpers",
};

export function spacesFor(isParent: boolean): Space[] {
  return SPACES.filter((s) => !(isParent && s.notForParents)).map((s) => (isParent && PARENT_NOTES[s.id] ? { ...s, note: PARENT_NOTES[s.id] as string } : s));
}

/** The space a path belongs to, and which of its rooms is open. */
export function spaceFor(pathname: string): { space: Space; room: string } | null {
  for (const space of SPACES) {
    for (const r of space.rooms) {
      if (pathname === r.href || pathname.startsWith(`${r.href}/`)) return { space, room: r.href };
    }
  }
  return null;
}
