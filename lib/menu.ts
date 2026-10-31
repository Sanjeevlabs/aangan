// Every feature since PR #1, in five rooms of a house (SPEC §29.3). The
// single source of rooms → ordered tabs. The rooms sheet shows only the five
// rooms; a room opens on its first tab, and inside it the tab row (lib/spaces.ts
// → RoomHeader) is the only way sideways. A room with one page (Kitchen) has
// no tab row. Every tab is its own page: no two tabs anywhere share one.
// Safe & sound is not here: it lives on the window, the first screen.
// Settings is not here either: tap your own photo. Invite family lives on the
// tree page and in Settings.

export interface RoomTab {
  href: string;
  /** Short label, shown in the tab row and as the page's title. */
  label: string;
}
export interface Room {
  id: "memories" | "kitchen" | "care" | "family" | "celebrations";
  title: string;
  /** One line under the tile: what's in this room. */
  note: string;
  icon: string;
  /** In order. The tile opens the first one. */
  tabs: RoomTab[];
}

export function roomsFor(isParent: boolean): Room[] {
  return [
    {
      id: "memories",
      title: "Memories",
      note: "Every photo and voice, stories",
      icon: "memories",
      tabs: [
        { href: "/lane", label: "Memory Lane" },
        { href: "/stories", label: "Stories" },
      ],
    },
    {
      id: "kitchen",
      title: "Kitchen",
      note: isParent ? "Your recipes, and who cooked them" : "Recipes, in the voice that taught them",
      icon: "pot",
      tabs: [{ href: "/kitchen", label: "Recipes" }],
    },
    {
      id: "care",
      title: "Care",
      note: "Send something, help at home, people nearby",
      icon: "care",
      tabs: [
        { href: "/send", label: "Send something" },
        { href: "/care", label: "Care tasks" },
        { href: "/care/helpers", label: "Local helpers" },
        { href: "/nearby", label: "Trusted nearby" },
      ],
    },
    {
      id: "family",
      title: "Family",
      note: "Tree, the Book, advice, a portrait",
      icon: "tree",
      tabs: [
        { href: "/bond", label: "Family tree" },
        { href: "/book", label: "The Book" },
        { href: "/advice", label: "Advice" },
        { href: "/portrait", label: "Portrait" },
      ],
    },
    {
      id: "celebrations",
      title: "Celebrations",
      note: "Birthdays, occasions, visits, holidays, play",
      icon: "gift",
      tabs: [
        { href: "/gather", label: "Coming up" },
        { href: "/rituals", label: "Occasions" },
        { href: "/together/visits", label: "Visits" },
        { href: "/together/holidays", label: "Holidays" },
        { href: "/gather/play", label: "Play" },
      ],
    },
  ];
}

/** Where a room's tile goes: its first tab. */
export function roomHref(room: Room): string {
  return room.tabs[0].href;
}
