import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/rituals/route";
import { laneGroups, monthChip, rangeLabel } from "@/lib/lane-groups";
import { addDays, holidayVisible, hourLabel, monthGrid, occasionsInRange, visibleHolidays } from "@/lib/occasion-calendar";
import { resetHolidayCache } from "@/lib/holidays";
import { resetRitualSettings } from "@/lib/occasion-settings";
import { nextOccasion } from "@/lib/occasions-server";
import { DEMO_MEMBERS } from "@/lib/family";
import { CardSchema, MemberSchema } from "@/lib/schemas";
import { resetDemo } from "@/lib/store";
import { authedGet, authedJson } from "./auth-helper";

const members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));
const H = (key: string, date: string, traditions: string[], kind: "festival" | "national" = "festival") => ({ key, date, title: key.toUpperCase(), kind, traditions, ritual: null, lampHour: kind === "festival" ? 19 : null });
const HOLIDAYS = [H("fest-a", "2026-11-08", ["t1"]), H("fest-b", "2026-11-05", ["t2"]), H("nat", "2026-11-20", [], "national")];
const none = { traditions: [], kept: [], skipped: [] };

describe("occasion calendar (pure)", () => {
  it("shows birthdays and national days always, festivals by tradition", () => {
    const people = [{ id: "p1", birthday: "11-03" }, { id: "p2", birthday: "" }];
    const plain = occasionsInRange(people, visibleHolidays(HOLIDAYS, none), "2026-11-01", "2026-11-30");
    expect(plain.map((o) => o.id)).toEqual(["birthday:p1:2026-11-03", "nat:2026-11-20"]);
    const t1 = occasionsInRange(people, visibleHolidays(HOLIDAYS, { ...none, traditions: ["t1"] }), "2026-11-01", "2026-11-30");
    expect(t1.map((o) => [o.slug, o.date, o.kind, o.lampHour])).toEqual([
      ["birthday", "2026-11-03", "birthday", null],
      ["fest-a", "2026-11-08", "festival", 19],
      ["nat", "2026-11-20", "national", null],
    ]);
  });

  it("manual overrides win: kept on, skipped off", () => {
    expect(holidayVisible(HOLIDAYS[1], { traditions: ["t1"], kept: ["fest-b"], skipped: [] })).toBe(true);
    expect(holidayVisible(HOLIDAYS[0], { traditions: ["t1"], kept: [], skipped: ["fest-a"] })).toBe(false);
    expect(holidayVisible(HOLIDAYS[2], { traditions: [], kept: [], skipped: ["nat"] })).toBe(false);
    expect(holidayVisible({ ...HOLIDAYS[1], ritual: "cfg" }, { traditions: [], kept: ["cfg"], skipped: [] })).toBe(true);
    expect(hourLabel(19)).toBe("7 PM");
    expect(hourLabel(0)).toBe("12 AM");
  });

  it("wraps birthdays across a year boundary and keeps 29 Feb on 28 Feb", () => {
    const list = occasionsInRange([{ id: "a", birthday: "01-02" }, { id: "b", birthday: "02-29" }], [], "2026-12-20", "2027-03-01");
    expect(list.map((o) => o.date)).toEqual(["2027-01-02", "2027-02-28"]);
  });

  it("builds whole weeks for a month", () => {
    const g = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(g.length % 7).toBe(0);
    expect(g[0]).toEqual({ iso: "2026-11-01", day: 1, inMonth: true });
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("nextOccasion", () => {
  it("includes given festivals, never national days", () => {
    const now = new Date("2026-11-06T00:00:00Z");
    expect(nextOccasion([], now, 30, [])).toBeNull();
    expect(nextOccasion([], now, 30, [HOLIDAYS[2]])).toBeNull();
    expect(nextOccasion([], now, 30, [HOLIDAYS[0]])?.slug).toBe("fest-a");
  });

  it("still finds birthdays with nothing chosen", () => {
    const occ = nextOccasion(members, new Date("2026-11-08T00:00:00Z"), 7);
    expect(occ?.slug).toBe("birthday");
  });
});

describe("/api/rituals traditions", () => {
  beforeEach(() => {
    resetDemo();
    resetRitualSettings();
    resetHolidayCache();
  });

  type Body = { traditions: string[]; kept: string[]; skipped: string[]; holidays: { key: string; kind: string; traditions: string[]; lampHour: number | null }[]; holidaySource: string; country: string; canEditKept: boolean; traditionChoices: { id: string }[] };

  it("defaults to no traditions, serves the bundled calendar in mock mode", async () => {
    const res = await GET(authedGet("http://test/api/rituals", "arjun"));
    const body = (await res.json()) as Body;
    expect(body.traditions).toEqual([]);
    expect(body.canEditKept).toBe(true);
    expect(body.country).toBe("IN");
    expect(body.holidaySource).toBe("fallback");
    expect(body.traditionChoices.map((t) => t.id)).toHaveLength(8);
    expect(body.holidays.some((h) => h.kind === "national")).toBe(true);
    const fest = body.holidays.find((h) => h.kind === "festival");
    expect(fest?.lampHour).toBe(19);
  });

  it("lets a grown-up choose traditions and overrides; 'none' stands alone", async () => {
    const saved = await POST(authedJson("http://test/api/rituals", { action: "traditions", traditions: ["sikh", "jain"], kept: ["easter"] }, "dadi"));
    expect(saved.status).toBe(200);
    const body = (await (await GET(authedGet("http://test/api/rituals", "dadi"))).json()) as Body;
    expect(body.traditions).toEqual(["sikh", "jain"]);
    expect(body.kept).toEqual(["easter"]);
    const out = (await (await POST(authedJson("http://test/api/rituals", { action: "traditions", traditions: ["hindu", "none"] }, "arjun"))).json()) as Body;
    expect(out.traditions).toEqual(["none"]);
    expect(out.kept).toEqual(["easter"]);
  });

  it("keeps the legacy kept action working", async () => {
    expect((await POST(authedJson("http://test/api/rituals", { action: "kept", kept: ["diwali"] }, "arjun"))).status).toBe(200);
  });

  it("refuses child accounts, unknown festivals and traditions", async () => {
    expect((await POST(authedJson("http://test/api/rituals", { action: "traditions", traditions: [] }, "aria"))).status).toBe(403);
    expect((await POST(authedJson("http://test/api/rituals", { action: "kept", kept: ["not-a-config"] }, "arjun"))).status).toBe(400);
    expect((await POST(authedJson("http://test/api/rituals", { action: "kept", kept: ["birthday"] }, "arjun"))).status).toBe(400);
    expect((await POST(authedJson("http://test/api/rituals", { action: "traditions", traditions: ["martian"] }, "arjun"))).status).toBe(400);
  });
});

describe("memory lane grouping", () => {
  const card = (id: string, type: "photo" | "audio" | "video", takenAt: string, authorId = "dadi") =>
    CardSchema.parse({ id, familyId: "demo-family", type, caption: id, lang: "en", takenAt, authorId });

  it("splits by kind, newest first, and filters by person", () => {
    const cards = [card("p1", "photo", "2019-03-01T00:00:00.000Z"), card("a1", "audio", "2026-10-01T00:00:00.000Z"), card("p2", "photo", "2026-10-02T00:00:00.000Z", "arjun"), card("v1", "video", "2025-01-01T00:00:00.000Z")];
    const g = laneGroups(cards, null);
    expect(g.photo.map((c) => c.id)).toEqual(["p2", "p1"]);
    expect(g.audio.map((c) => c.id)).toEqual(["a1"]);
    expect(g.video.map((c) => c.id)).toEqual(["v1"]);
    expect(laneGroups(cards, "arjun").photo.map((c) => c.id)).toEqual(["p2"]);
  });

  it("labels the timeline", () => {
    expect(rangeLabel([{ takenAt: "2026-10-02T12:00:00.000Z" }, { takenAt: "2019-03-01T12:00:00.000Z" }])).toBe("Oct 2026 → 2019");
    expect(rangeLabel([])).toBe("");
    expect(monthChip("2026-10-02T12:00:00.000Z")).toBe("Oct ’26");
    expect(monthChip("nope")).toBe("Undated");
  });
});
