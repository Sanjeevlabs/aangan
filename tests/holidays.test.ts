import { beforeEach, describe, expect, it } from "vitest";
import { countryForZones, holidaysFor, mapHolidays, mergeWithFallback, parseIcs, resetHolidayCache } from "@/lib/holidays";
import { withRitualLampHours, ritualConfigs } from "@/lib/occasions-server";

// A trimmed sample in the shape Google's public holiday feed serves (CRLF,
// folded lines, escaped commas, a timed DTSTART).
const SAMPLE = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "VERSION:2.0",
  "X-WR-CALNAME:Holidays in India",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261108",
  "DTEND;VALUE=DATE:20261109",
  "UID:20261108_abc@google.com",
  "SUMMARY:Diwali/Deepavali",
  "DESCRIPTION:Public holiday",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20270310",
  "SUMMARY:Eid ul-Fitar",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261124",
  "SUMMARY:Guru Nanak",
  "  Jayanti",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20260126T000000Z",
  "SUMMARY:Republic Day",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261225",
  "SUMMARY:Christmas",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261029",
  "SUMMARY:Karva Chauth\\, observance",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:No date",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("iCal parser", () => {
  it("reads all-day VEVENTs, unfolds lines, unescapes text, skips broken events", () => {
    const ev = parseIcs(SAMPLE);
    expect(ev).toEqual([
      { date: "2026-11-08", summary: "Diwali/Deepavali" },
      { date: "2027-03-10", summary: "Eid ul-Fitar" },
      { date: "2026-11-24", summary: "Guru Nanak Jayanti" },
      { date: "2026-01-26", summary: "Republic Day" },
      { date: "2026-12-25", summary: "Christmas" },
      { date: "2026-10-29", summary: "Karva Chauth, observance" },
    ]);
  });

  it("maps names to traditions; unmatched names drop; national days per country", () => {
    const items = mapHolidays(parseIcs(SAMPLE), "IN");
    const by = Object.fromEntries(items.map((h) => [h.key, h]));
    expect(by.diwali.traditions).toContain("hindu");
    expect(by.diwali.ritual).toBe("diwali");
    expect(by["eid-ul-fitr"].traditions).toEqual(["muslim"]);
    expect(by["guru-nanak-jayanti"].traditions).toEqual(["sikh"]);
    expect(by.christmas.traditions).toEqual(["christian"]);
    expect(by["republic-day"].kind).toBe("national");
    expect(by["republic-day"].lampHour).toBeNull();
    expect(items.some((h) => h.title.startsWith("Karva"))).toBe(false);
    // An Indian national day is not a national day in the UK.
    expect(mapHolidays(parseIcs(SAMPLE), "GB").some((h) => h.key === "republic-day")).toBe(false);
  });

  it("fills festivals the feed lacks from the bundled list", () => {
    const uk = mergeWithFallback(mapHolidays([{ date: "2026-12-25", summary: "Christmas Day" }], "GB"), "GB");
    expect(uk.filter((h) => h.key === "christmas" && h.date.startsWith("2026"))).toHaveLength(1);
    expect(uk.some((h) => h.key === "diwali" && h.date === "2026-11-08")).toBe(true);
    expect(uk.some((h) => h.kind === "national")).toBe(false);
  });

  it("a linked ritual config's lampHour applies", () => {
    const items = withRitualLampHours(mapHolidays(parseIcs(SAMPLE), "IN"), ritualConfigs());
    expect(items.find((h) => h.key === "diwali")?.lampHour).toBe(19);
    expect(items.find((h) => h.key === "christmas")?.lampHour).toBe(19);
  });
});

describe("country and source", () => {
  beforeEach(() => resetHolidayCache());

  it("picks the most common country among members' time zones", () => {
    expect(countryForZones(["Asia/Kolkata", "Asia/Kolkata", "Europe/London"])).toBe("IN");
    expect(countryForZones(["Europe/London", "Europe/London", "Asia/Kolkata"])).toBe("GB");
    expect(countryForZones(["America/Toronto"])).toBe("CA");
    expect(countryForZones(["America/Chicago"])).toBe("US");
    expect(countryForZones(["Pacific/Fiji"])).toBe("IN");
  });

  it("uses the feed when it answers, caches it for a day", async () => {
    let calls = 0;
    const fetchText = async () => {
      calls++;
      return SAMPLE;
    };
    const a = await holidaysFor("IN", { fetchText, now: 0 });
    expect(a.source).toBe("google");
    expect(a.items.some((h) => h.key === "diwali")).toBe(true);
    // Bundled festivals fill in what the sample lacks.
    expect(a.items.some((h) => h.key === "mahavir-jayanti" && h.date === "2027-04-19")).toBe(true);
    await holidaysFor("IN", { fetchText, now: 60_000 });
    expect(calls).toBe(1);
    await holidaysFor("IN", { fetchText, now: 25 * 3600_000 });
    expect(calls).toBe(2);
  });

  it("falls back to the bundled list when the feed fails or times out", async () => {
    const failed = await holidaysFor("IN", { fetchText: async () => Promise.reject(new Error("offline")), now: 0 });
    expect(failed.source).toBe("fallback");
    expect(failed.items.find((h) => h.key === "diwali" && h.date.startsWith("2026"))?.date).toBe("2026-11-08");
    expect(failed.items.find((h) => h.key === "eid-ul-fitr" && h.date.startsWith("2027"))?.date).toBe("2027-03-10");
    expect(failed.items.find((h) => h.key === "holi" && h.date.startsWith("2027"))?.date).toBe("2027-03-23");
    expect(failed.items.some((h) => h.key === "independence-day-in")).toBe(true);
    resetHolidayCache();
    const mock = await holidaysFor("IN");
    expect(mock.source).toBe("fallback");
  });
});
