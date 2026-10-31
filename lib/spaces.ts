// Tabs inside a room (SPEC §29.3): once you're in a room, its spaces show as
// tabs so you can move sideways without going back. Derived from the five
// rooms in lib/menu.ts. A room with one page (Kitchen) has no tab row.
import { roomsFor, type Room } from "./menu";

export interface Space {
  id: Room["id"];
  title: string;
  rooms: { href: string; title: string }[];
}

/** Tab labels. A page missing here (Send, Invite) is in the menu but not a tab. */
const SHORT: Record<string, string> = {
  "/lane": "Memory Lane",
  "/rituals": "Occasions",
  "/stories": "Stories",
  "/kitchen": "Recipes",
  "/care": "Care tasks",
  "/care/helpers": "Local helpers",
  "/nearby": "Trusted nearby",
  "/bond": "Family tree",
  "/book": "Book",
  "/advice": "Advice",
  "/gather": "Plan",
  "/together/visits": "Visits",
  "/together/holidays": "Holidays",
  "/gather/play": "Play",
};

export function spacesFor(isParent: boolean): Space[] {
  return roomsFor(isParent, "").map((r) => ({
    id: r.id,
    title: r.title,
    rooms: Array.from(new Set(r.items.map((i) => i.href.split("#")[0])))
      .filter((h) => SHORT[h])
      .map((href) => ({ href, title: SHORT[href] })),
  }));
}

const ALL = spacesFor(false);

/** The space a path belongs to, and which of its rooms is open (the longest matching page wins). */
export function spaceFor(pathname: string): { space: Space; room: string } | null {
  let best: { space: Space; room: string } | null = null;
  for (const space of ALL) {
    for (const r of space.rooms) {
      if ((pathname === r.href || pathname.startsWith(`${r.href}/`)) && (!best || r.href.length > best.room.length)) best = { space, room: r.href };
    }
  }
  return best;
}
