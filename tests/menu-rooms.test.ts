import { describe, expect, it } from "vitest";
import { roomsFor } from "@/lib/menu";
import { spaceFor, spacesFor } from "@/lib/spaces";

const page = (href: string) => href.split("#")[0];

describe("the five rooms", () => {
  for (const isParent of [false, true]) {
    it(`gives every item in a room its own page (${isParent ? "parent" : "child"})`, () => {
      for (const room of roomsFor(isParent)) {
        const pages = room.items.map((i) => page(i.href));
        expect(new Set(pages).size, room.title).toBe(pages.length);
      }
    });

    it(`never points a menu item or tab at Safe & sound or Settings (${isParent ? "parent" : "child"})`, () => {
      const rooms = roomsFor(isParent);
      const hrefs = [...rooms.flatMap((r) => r.items.map((i) => page(i.href))), ...rooms.map((r) => r.href ?? "")];
      expect(hrefs).not.toContain("/safe");
      expect(rooms.flatMap((r) => r.items).filter((i) => i.href === "/settings")).toEqual([]);
      expect(spacesFor(isParent).flatMap((s) => s.rooms.map((r) => r.href))).not.toContain("/safe");
    });
  }

  it("groups the rooms as agreed", () => {
    const items = Object.fromEntries(roomsFor(false).map((r) => [r.id, r.items.map((i) => i.href)]));
    expect(items).toEqual({
      memories: ["/lane", "/rituals", "/stories"],
      kitchen: ["/kitchen"],
      care: ["/care", "/care/helpers", "/nearby", "/send"],
      family: ["/bond", "/book", "/advice", "/settings#invite"],
      sit: ["/gather", "/together/visits", "/together/holidays", "/gather/play"],
    });
  });

  it("shows each room's tabs on its pages; Kitchen and Safe & sound have none", () => {
    const tabs = (path: string) => {
      const at = spaceFor(path);
      return at && at.room === path && at.space.rooms.length > 1 ? at.space.rooms.map((r) => r.title) : [];
    };
    expect(tabs("/stories")).toEqual(["Memory Lane", "Occasions", "Stories"]);
    expect(tabs("/book")).toEqual(["Family tree", "Book", "Advice"]);
    expect(tabs("/care")).toEqual(["Care tasks", "Local helpers", "Trusted nearby"]);
    expect(tabs("/care/helpers")).toEqual(["Care tasks", "Local helpers", "Trusted nearby"]);
    expect(tabs("/gather")).toEqual(["Plan", "Visits", "Holidays", "Play"]);
    expect(tabs("/gather/play")).toEqual(["Plan", "Visits", "Holidays", "Play"]);
    expect(spaceFor("/gather/play")?.room).toBe("/gather/play");
    expect(tabs("/kitchen")).toEqual([]);
    expect(tabs("/safe")).toEqual([]);
    // An event page inside Get-together is not a tab of its own.
    expect(tabs("/gather/ev_123")).toEqual([]);
  });
});
