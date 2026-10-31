// Tabs inside a room (SPEC §29.3): once you're in a room, its pages show as
// tabs so you can move sideways without going back. Derived from the five
// rooms in lib/menu.ts. A room with one page (Kitchen) has no tab row.
import { roomsFor, type Room } from "./menu";

export interface Space {
  id: Room["id"];
  title: string;
  rooms: { href: string; title: string }[];
}

export function spacesFor(isParent: boolean): Space[] {
  return roomsFor(isParent).map((r) => ({ id: r.id, title: r.title, rooms: r.tabs.map((t) => ({ href: t.href, title: t.label })) }));
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

/** The tab row for a page: only on a room's own tab page, and only when the room has more than one. */
export function tabsFor(pathname: string): { space: Space; room: string } | null {
  const at = spaceFor(pathname);
  return at && at.room === pathname && at.space.rooms.length > 1 ? at : null;
}
