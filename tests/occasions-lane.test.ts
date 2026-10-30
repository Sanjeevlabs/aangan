import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/rituals/route";
import { laneGroups, monthChip, rangeLabel } from "@/lib/lane-groups";
import { addDays, monthGrid, occasionsInRange } from "@/lib/occasion-calendar";
import { resetRitualSettings } from "@/lib/occasion-settings";
import { festivalChoices, nextOccasion } from "@/lib/occasions-server";
import { DEMO_MEMBERS } from "@/lib/family";
import { CardSchema, MemberSchema } from "@/lib/schemas";
import { resetDemo } from "@/lib/store";
import { authedGet, authedJson } from "./auth-helper";

const members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));
const CONFIGS = [
  { slug: "birthday", title: "Birthday — family guide" },
  { slug: "fest-a", title: "Fest A — family guide" },
  { slug: "fest-b", title: "Fest B" },
];
const MOVABLE = { "fest-a": "2026-11-08", "fest-b": "2026-11-05" };

describe("occasion calendar (pure)", () => {
  it("shows birthdays always and only the festivals the family keeps", () => {
    const people = [{ id: "p1", birthday: "11-03" }, { id: "p2", birthday: "" }];
    const none = occasionsInRange(people, CONFIGS, MOVABLE, [], "2026-11-01", "2026-11-30");
    expect(none.map((o) => o.id)).toEqual(["birthday:p1:2026-11-03"]);
    const kept = occasionsInRange(people, CONFIGS, MOVABLE, ["fest-a"], "2026-11-01", "2026-11-30");
    expect(kept.map((o) => [o.slug, o.date, o.title])).toEqual([
      ["birthday", "2026-11-03", ""],
      ["fest-a", "2026-11-08", "Fest A"],
    ]);
  });

  it("wraps birthdays across a year boundary and keeps 29 Feb on 28 Feb", () => {
    const list = occasionsInRange([{ id: "a", birthday: "01-02" }, { id: "b", birthday: "02-29" }], [], {}, [], "2026-12-20", "2027-03-01");
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

describe("nextOccasion respects kept festivals", () => {
  it("ignores festivals not kept, includes them when kept", () => {
    const slug = festivalChoices()[0]?.slug;
    expect(slug).toBeTruthy();
    const now = new Date("2026-11-06T00:00:00Z");
    const without = nextOccasion([], now, 30, []);
    expect(without).toBeNull();
    const withIt = nextOccasion([], now, 30, [slug as string]);
    expect(withIt?.slug).toBe(slug);
  });

  it("still finds birthdays with nothing kept", () => {
    const occ = nextOccasion(members, new Date("2026-11-08T00:00:00Z"), 7);
    expect(occ?.slug).toBe("birthday");
  });
});

describe("/api/rituals festivals we keep", () => {
  beforeEach(() => {
    resetDemo();
    resetRitualSettings();
  });

  it("defaults to none kept and hides festival dates", async () => {
    const res = await GET(authedGet("http://test/api/rituals", "arjun"));
    const body = (await res.json()) as { kept: string[]; movable: Record<string, string>; canEditKept: boolean; configs: { slug: string }[] };
    expect(body.kept).toEqual([]);
    expect(body.movable).toEqual({});
    expect(body.canEditKept).toBe(true);
    expect(body.configs.length).toBeGreaterThan(1);
  });

  it("lets a member save the list; it then resolves those dates", async () => {
    const slug = festivalChoices()[0].slug;
    const saved = await POST(authedJson("http://test/api/rituals", { action: "kept", kept: [slug] }, "dadi"));
    expect(saved.status).toBe(200);
    const body = (await (await GET(authedGet("http://test/api/rituals", "dadi"))).json()) as { kept: string[]; movable: Record<string, string> };
    expect(body.kept).toEqual([slug]);
    expect(Object.keys(body.movable)).toContain(slug);
  });

  it("refuses child accounts and unknown slugs", async () => {
    expect((await POST(authedJson("http://test/api/rituals", { action: "kept", kept: [] }, "aria"))).status).toBe(403);
    expect((await POST(authedJson("http://test/api/rituals", { action: "kept", kept: ["not-a-config"] }, "arjun"))).status).toBe(400);
    expect((await POST(authedJson("http://test/api/rituals", { action: "kept", kept: ["birthday"] }, "arjun"))).status).toBe(400);
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
