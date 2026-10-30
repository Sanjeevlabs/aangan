// Tabs inside a room (SPEC §29.3): once you're in a room of the family
// courtyard, its spaces show as tabs so you can move sideways without going
// back to the courtyard. Derived from the four rooms in lib/menu.ts.
import { roomsFor, type Room } from "./menu";

export interface Space {
  id: Room["id"];
  title: string;
  rooms: { href: string; title: string }[];
}

const SHORT: Record<string, string> = {
  "/lane": "Memory Lane",
  "/rituals": "Occasions",
  "/reel": "Reel",
  "/ask": "Ask",
  "/kitchen": "Kitchen",
  "/stories": "Stories",
  "/advice": "Advice",
  "/care": "Care board",
  "/nearby": "Trusted nearby",
  "/safe": "Safe & sound",
  "/around": "Around",
  "/together": "Visits",
  "/bond": "Family tree",
  "/gather": "Sit together",
};

export function spacesFor(isParent: boolean): Space[] {
  return roomsFor(isParent, "").map((r) => ({
    id: r.id,
    title: r.title,
    // One tab per page (anchors like /care#helpers share their page's tab).
    rooms: Array.from(new Set(r.items.map((i) => i.href.split("#")[0])))
      .filter((h) => SHORT[h])
      .map((href) => ({ href, title: SHORT[href] })),
  }));
}

const ALL = spacesFor(false);

/** The space a path belongs to, and which of its rooms is open. */
export function spaceFor(pathname: string): { space: Space; room: string } | null {
  for (const space of ALL) {
    for (const r of space.rooms) {
      if (pathname === r.href || pathname.startsWith(`${r.href}/`)) return { space, room: r.href };
    }
  }
  return null;
}
