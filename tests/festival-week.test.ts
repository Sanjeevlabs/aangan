import { describe, expect, it } from "vitest";
import { daysInWords, festivalWeek, pickLead, type FestivalRitual, type FestivalWeekInput } from "@/lib/festival-week";
import { lampGlowCss } from "@/lib/lamp";
import type { CalHoliday } from "@/lib/occasion-calendar";
import { planRitualScan } from "@/lib/ritual-agent";
import { loadRitualConfig } from "@/lib/rituals";
import { ritualConfigs } from "@/lib/occasions-server";
import type { Member } from "@/lib/schemas";

// Synthetic festival: the engine names none, so neither do these tests.
const fest = (key: string, date: string, ritual: string | null = "harvest"): CalHoliday => ({ key, date, title: "Harvest Lights", kind: "festival", traditions: ["t1"], ritual, lampHour: 19 });
const config: FestivalRitual = {
  slug: "harvest",
  title: "Harvest Lights — family guide",
  accent: "#D9822B",
  lampAccent: "#F5A524",
  greeting: "Joyful harvest",
  steps: [
    { key: "a", kind: "photo", prompt: "Light the first lamp.", cardTemplate: "{caption}" },
    { key: "b", kind: "audio", prompt: "Say the blessing.", cardTemplate: "{caption}" },
  ],
};
const mem = (id: string, role: "elder" | "adult" | "child", access: "owner" | "admin" | "member" | "child" = "member", status: "active" | "pending" = "active") => ({ id, role, access, status });
const people = [mem("dadi", "elder"), mem("dada", "elder"), mem("arjun", "adult", "owner"), mem("leo", "child", "child")];
const card = (id: string, takenAt: string, over: Record<string, unknown> = {}) => ({ id, type: "photo" as const, takenAt, ritualSlug: "harvest", mediaRef: "/demo/x.webp", coverRef: null, ...over });

const base = (over: Partial<FestivalWeekInput> = {}): FestivalWeekInput => ({
  today: "2026-11-04",
  holidays: [fest("harvest", "2026-11-08")],
  choices: { traditions: ["t1"], kept: [], skipped: [] },
  configs: [config],
  cards: [],
  members: people,
  viewerId: "arjun",
  ...over,
});

describe("festivalWeek: the window", () => {
  it("includes the day itself and exactly seven days ahead, nothing eight out or past", () => {
    expect(festivalWeek(base({ today: "2026-11-08" }))?.daysLeft).toBe(0);
    expect(festivalWeek(base({ today: "2026-11-01" }))?.daysLeft).toBe(7);
    expect(festivalWeek(base({ today: "2026-10-31" }))).toBeNull();
    expect(festivalWeek(base({ today: "2026-11-09" }))).toBeNull();
  });

  it("picks the nearest of two festivals and carries the ritual's own data", () => {
    const w = festivalWeek(base({ holidays: [fest("later", "2026-11-10"), fest("harvest", "2026-11-08")], configs: [config, { ...config, slug: "later-guide", accent: "#000000" }] }));
    expect(w).toMatchObject({ slug: "harvest", title: "Harvest Lights", date: "2026-11-08", daysLeft: 4, accent: "#D9822B", lampAccent: "#F5A524", greeting: "Joyful harvest" });
    expect(w?.stepsForLead).toEqual(["Light the first lamp.", "Say the blessing."]);
  });

  it("needs a ritual config with steps; a festival without one is not a week", () => {
    expect(festivalWeek(base({ holidays: [fest("harvest", "2026-11-08", null)] }))).toBeNull();
    expect(festivalWeek(base({ configs: [] }))).toBeNull();
    expect(festivalWeek(base({ configs: [{ ...config, steps: [] }] }))).toBeNull();
  });

  it("ignores national days", () => {
    expect(festivalWeek(base({ holidays: [{ ...fest("harvest", "2026-11-08"), kind: "national" }] }))).toBeNull();
  });
});

describe("festivalWeek: kept and skipped", () => {
  it("shows only festivals the family keeps", () => {
    expect(festivalWeek(base({ choices: { traditions: [], kept: [], skipped: [] } }))).toBeNull();
    expect(festivalWeek(base({ choices: { traditions: [], kept: ["harvest"], skipped: [] } }))?.slug).toBe("harvest");
    expect(festivalWeek(base({ choices: { traditions: [], kept: ["harvest"], skipped: [] }, holidays: [fest("other-key", "2026-11-08")] }))?.slug).toBe("harvest"); // kept by ritual slug
  });

  it("skipped beats a chosen tradition", () => {
    expect(festivalWeek(base({ choices: { traditions: ["t1"], kept: [], skipped: ["harvest"] } }))).toBeNull();
  });
});

describe("festivalWeek: who leads, who does what", () => {
  it("the eldest elder leads (first elder in tree order), pending invitations last", () => {
    expect(pickLead(people)).toBe("dadi");
    expect(pickLead([mem("dadi", "elder", "member", "pending"), mem("dada", "elder")])).toBe("dada");
    expect(pickLead([mem("dadi", "elder", "member", "pending")])).toBe("dadi");
  });

  it("with no elder the host leads: owner, then admin, then a grown-up", () => {
    expect(pickLead([mem("kid", "child", "child"), mem("b", "adult", "member"), mem("a", "adult", "owner")])).toBe("a");
    expect(pickLead([mem("b", "adult", "member"), mem("c", "adult", "admin")])).toBe("c");
    expect(pickLead([mem("b", "adult", "member")])).toBe("b");
    expect(pickLead([])).toBeNull();
    expect(festivalWeek(base({ members: [] }))).toBeNull();
  });

  it("an elder sees lead; a child sees ask; an adult sees wish; the host-lead sees lead", () => {
    expect(festivalWeek(base({ viewerId: "dada" }))?.mode).toBe("lead");
    expect(festivalWeek(base({ viewerId: "leo" }))?.mode).toBe("ask");
    expect(festivalWeek(base({ viewerId: "arjun" }))?.mode).toBe("wish");
    expect(festivalWeek(base({ members: [mem("a", "adult", "owner"), mem("leo", "child", "child")], viewerId: "a" }))?.mode).toBe("lead");
    expect(festivalWeek(base({ viewerId: "leo" }))?.lead).toBe("dadi");
  });

  it("asks the lead a question in the festival's own words", () => {
    expect(festivalWeek(base())?.askForChildren).toContain("Harvest Lights");
  });
});

describe("festivalWeek: the family's past photos", () => {
  it("lists earlier years' photos of this festival, newest first, at most six", () => {
    const cards = [
      card("y25a", "2025-11-01T10:00:00Z"),
      card("y25b", "2025-11-01T12:00:00Z"),
      card("y24", "2024-11-02T10:00:00Z"),
      card("y23", "2023-11-02T10:00:00Z"),
      card("y22", "2022-11-02T10:00:00Z"),
      card("y21", "2021-11-02T10:00:00Z"),
      card("y20", "2020-11-02T10:00:00Z"),
      card("this-year", "2026-11-01T10:00:00Z"),
      card("voice", "2025-11-01T10:00:00Z", { type: "audio" }),
      card("other-fest", "2025-11-01T10:00:00Z", { ritualSlug: "else" }),
      card("no-photo", "2025-11-01T10:00:00Z", { mediaRef: null }),
    ];
    expect(festivalWeek(base({ cards }))?.pastPhotos).toEqual(["y25b", "y25a", "y24", "y23", "y22", "y21"]);
  });

  it("no past photos is still a week", () => {
    const w = festivalWeek(base({ cards: [] }));
    expect(w).not.toBeNull();
    expect(w?.pastPhotos).toEqual([]);
  });

  it("a ritual without colour or greeting is neutral, not broken", () => {
    const w = festivalWeek(base({ configs: [{ slug: "harvest", title: "Harvest Lights", steps: config.steps }] }));
    expect(w).toMatchObject({ accent: null, greeting: null, lampAccent: null });
  });

  it("a bad colour never gets through", () => {
    const w = festivalWeek(base({ configs: [{ ...config, accent: "red; x", lampAccent: "url(x)" }] }));
    expect(w).toMatchObject({ accent: null, lampAccent: null });
  });
});

describe("words, lamp and data", () => {
  it("counts days in words", () => {
    expect([0, 1, 4, 7].map(daysInWords)).toEqual(["today", "tomorrow", "in four days", "in seven days"]);
  });

  it("the lamp glow comes from the accent; none means the usual glow", () => {
    expect(lampGlowCss("#F5A524")).toContain("245,165,36");
    expect(lampGlowCss(null)).toBe("");
    expect(lampGlowCss("red; }")).toBe("");
  });

  it("the shipped ritual JSON carries accent and greeting, and the schema rejects a bad colour", () => {
    const shipped = ritualConfigs();
    for (const slug of ["diwali", "birthday"]) {
      const c = shipped.find((x) => x.slug === slug);
      expect(c?.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c?.greeting).toBeTruthy();
    }
    expect(() => loadRitualConfig({ ...config, cultureNotes: "x", accent: "orange" })).toThrow();
  });
});

describe("ritual scan: the lead is asked at seven days", () => {
  const m = (id: string, role: Member["role"]): Member => ({ id, familyId: "f", firstName: id, displayName: id, role, lang: "en", displayLang: "en", tz: "UTC", city: "", birthday: "", homeImageRef: null, homePalette: [], photoRef: null, email: null, access: "member", status: "active", personId: null });
  const members = [m("dadi", "elder"), m("dada", "elder"), m("arjun", "adult"), m("leo", "child")];
  const scan = (now: string, ritual: string | null) => planRitualScan(now, members, [{ slug: "harvest", title: "Harvest Lights", ritual }], { harvest: "2026-11-08" }, { runs: [], wishes: [], roles: [] }, "f");

  it("creates request_lead for the lead only, with no model call", () => {
    const s = scan("2026-11-01T06:00:00Z", "harvest").suggestions.filter((x) => x.payload.action === "request_lead");
    expect(s).toHaveLength(1);
    expect(s[0].payload).toMatchObject({ memberId: "dadi", occasionDate: "2026-11-08" });
  });

  it("not for a festival without a guide, not inside three days, and wishes still go out", () => {
    expect(scan("2026-11-01T06:00:00Z", null).suggestions.some((x) => x.payload.action === "request_lead")).toBe(false);
    expect(scan("2026-11-06T06:00:00Z", "harvest").suggestions.some((x) => x.payload.action === "request_lead")).toBe(false);
    expect(scan("2026-11-01T06:00:00Z", "harvest").suggestions.some((x) => x.payload.action === "request_wish")).toBe(true);
  });
});
