// Five spaces instead of thirteen rooms. Every route still exists; a room now
// lives inside one space, and the space shows its rooms as a quiet row of tabs.

export interface Space {
  id: "home" | "memories" | "kitchen" | "care" | "family";
  title: string;
  note: string;
  icon: string;
  href: string;
  rooms: { href: string; title: string }[];
}

export const SPACES: Space[] = [
  { id: "home", title: "Home", note: "Who's around, and the latest voice", icon: "door", href: "/", rooms: [] },
  {
    id: "memories",
    title: "Memories",
    note: "Albums, the years, and bedtime stories",
    icon: "lane",
    href: "/lane",
    rooms: [
      { href: "/lane", title: "Albums" },
      { href: "/stories", title: "Stories" },
    ],
  },
  { id: "kitchen", title: "Kitchen", note: "Recipes in the voices that taught them", icon: "pot", href: "/kitchen", rooms: [] },
  {
    id: "care",
    title: "Care",
    note: "Shared tasks, local helpers, safe and sound",
    icon: "care",
    href: "/care",
    rooms: [
      { href: "/care", title: "Tasks & helpers" },
      { href: "/safe", title: "Safe & sound" },
    ],
  },
  {
    id: "family",
    title: "Family",
    note: "Everyone, both sides, and things to do together",
    icon: "tree",
    href: "/bond",
    rooms: [
      { href: "/bond", title: "Everyone" },
      { href: "/together", title: "Together" },
      { href: "/rituals", title: "Occasions" },
      { href: "/gather", title: "Sit together" },
    ],
  },
];

/** The space a path belongs to, and which of its rooms is open. */
export function spaceFor(pathname: string): { space: Space; room: string } | null {
  for (const space of SPACES) {
    for (const r of space.rooms) {
      if (pathname === r.href || pathname.startsWith(`${r.href}/`)) return { space, room: r.href };
    }
  }
  return null;
}
