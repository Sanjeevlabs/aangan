import { beforeEach, describe, expect, it } from "vitest";
import { GET as icsGET } from "@/app/api/gather/weekly-call.ics/route";
import { GET, PUT } from "@/app/api/gather/weekly-call/route";
import { WeeklyCallSchema } from "@/lib/kinds";
import { callLabel, nextOccurrence, weeklyCallIcs } from "@/lib/weekly-call";
import { resetDemo } from "@/lib/store";
import { authedGet, sessionCookie } from "./auth-helper";

beforeEach(() => {
  process.env.MOCK = "true";
  resetDemo();
});

const put = (member: string, body: unknown) =>
  PUT(new Request("http://test/api/gather/weekly-call", { method: "PUT", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: JSON.stringify(body) }));
const good = { weekday: 0, hour: 19, minute: 0, tz: "Asia/Kolkata", hostId: "dadi", name: "Sunday chai" };

describe("next occurrence", () => {
  const sunday7pm = { weekday: 0, hour: 19, minute: 0, tz: "Asia/Kolkata" };
  it("finds Sunday 19:00 IST (13:30 UTC), no DST", () => {
    // Fri 30 Oct 2026 12:00 UTC
    expect(nextOccurrence(sunday7pm, new Date("2026-10-30T12:00:00Z")).toISOString()).toBe("2026-11-01T13:30:00.000Z");
    // Sunday before the call: same day
    expect(nextOccurrence(sunday7pm, new Date("2026-11-01T13:29:00Z")).toISOString()).toBe("2026-11-01T13:30:00.000Z");
    // Exactly at the call: next week
    expect(nextOccurrence(sunday7pm, new Date("2026-11-01T13:30:00Z")).toISOString()).toBe("2026-11-08T13:30:00.000Z");
  });

  it("is the same wall time in January and July (IST has no DST)", () => {
    expect(nextOccurrence(sunday7pm, new Date("2027-01-05T00:00:00Z")).toISOString()).toBe("2027-01-10T13:30:00.000Z");
    expect(nextOccurrence(sunday7pm, new Date("2027-07-05T00:00:00Z")).toISOString()).toBe("2027-07-11T13:30:00.000Z");
  });

  it("shows both homes: IST evening is a UTC-5 morning", () => {
    const now = new Date("2026-11-30T12:00:00Z"); // winter: New York is UTC-5
    expect(callLabel(sunday7pm, now, "Asia/Kolkata", "America/New_York")).toBe("Sun 7 PM yours · 8:30 AM theirs");
    expect(callLabel(sunday7pm, now, "America/New_York", "Asia/Kolkata")).toBe("Sun 8:30 AM yours · 7 PM theirs");
  });

  it("names the far home's weekday when it differs", () => {
    const lateIst = { weekday: 1, hour: 1, minute: 0, tz: "Asia/Kolkata" }; // Mon 1 AM IST = Sun 19:30 UTC = Sun 11:30 AM PST
    expect(callLabel(lateIst, new Date("2026-11-30T12:00:00Z"), "Asia/Kolkata", "America/Los_Angeles")).toBe("Mon 1 AM yours · Sun 11:30 AM theirs");
  });

  it("keeps the call's own clock across a viewer DST change", () => {
    // New York leaves DST on 1 Nov 2026: the same IST call moves from UTC-4 to UTC-5 for the viewer.
    expect(callLabel(sunday7pm, new Date("2026-10-25T00:00:00Z"), "Asia/Kolkata", "America/New_York")).toBe("Sun 7 PM yours · 9:30 AM theirs");
    expect(callLabel(sunday7pm, new Date("2026-11-02T00:00:00Z"), "Asia/Kolkata", "America/New_York")).toBe("Sun 7 PM yours · 8:30 AM theirs");
  });

  it("works when the call was set in a DST zone", () => {
    const ny = { weekday: 0, hour: 9, minute: 0, tz: "America/New_York" };
    expect(nextOccurrence(ny, new Date("2026-10-30T00:00:00Z")).toISOString()).toBe("2026-11-01T14:00:00.000Z"); // 1 Nov 9:00 EST (DST ended 2 AM that day)
    expect(nextOccurrence(ny, new Date("2026-07-01T00:00:00Z")).toISOString()).toBe("2026-07-05T13:00:00.000Z"); // EDT
  });
});

describe("ICS", () => {
  const ics = weeklyCallIcs({ call: { weekday: 0, hour: 19, minute: 0, tz: "Asia/Kolkata", name: "Sunday chai" }, familyId: "demo-family", now: new Date("2026-10-30T12:00:00Z"), yourTz: "America/New_York", theirTz: "Asia/Kolkata" });
  it("is a valid weekly VEVENT with a TZID", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20261101T190000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
    expect(ics).toContain("SUMMARY:Sunday chai");
    expect(ics).toContain("UID:weekly-call-demo-family@aangan");
    // Both zones in the description (escaped newline), and no raw LF without CR.
    expect(ics).toMatch(/DESCRIPTION:Sunday chai\\, every Sunday\.\\nSun 8:30 AM yours · 7 PM theirs/);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });
  it("folds lines to 75 octets and balances BEGIN/END", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const count = (re: RegExp) => (ics.match(re) ?? []).length;
    expect(count(/^BEGIN:/gm)).toBe(count(/^END:/gm));
  });
  it("is served as text/calendar from the route", async () => {
    const res = await icsGET(authedGet("http://test/api/gather/weekly-call.ics", "arjun"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("RRULE:FREQ=WEEKLY;BYDAY=SU");
    expect(body).toContain("TZID=Asia/Kolkata");
  });
});

describe("/api/gather/weekly-call", () => {
  it("is seeded for the demo family: Sunday 19:00 IST, dadi, Sunday chai", async () => {
    const res = await GET(authedGet("http://test/api/gather/weekly-call", "arjun"));
    const { call, canSet } = (await res.json()) as { call: unknown; canSet: boolean };
    expect(WeeklyCallSchema.parse(call)).toMatchObject({ id: "weekly-call", weekday: 0, hour: 19, minute: 0, tz: "Asia/Kolkata", hostId: "dadi", name: "Sunday chai" });
    expect(canSet).toBe(true);
  });

  it("needs a session", async () => {
    expect((await GET(new Request("http://test/api/gather/weekly-call"))).status).toBe(401);
  });

  it("lets an adult set it and stores exactly the schema", async () => {
    const res = await put("arjun", { ...good, weekday: 6, hour: 20, minute: 30, name: "Saturday dal" });
    expect(res.status).toBe(200);
    const { call } = (await res.json()) as { call: Record<string, unknown> };
    expect(Object.keys(call).sort()).toEqual(["hostId", "hour", "id", "minute", "name", "tz", "updatedAt", "updatedBy", "weekday"]);
    expect(call).toMatchObject({ id: "weekly-call", weekday: 6, hour: 20, minute: 30, updatedBy: "arjun" });
    const again = (await (await GET(authedGet("http://test/api/gather/weekly-call", "leo"))).json()) as { call: { name: string }; canSet: boolean };
    expect(again.call.name).toBe("Saturday dal");
    expect(again.canSet).toBe(false);
  });

  it("name is optional", async () => {
    const { name: _n, ...noName } = good;
    void _n;
    const res = await put("dadi", noName);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { call: { name?: string } }).call.name).toBeUndefined();
  });

  it.each([
    ["weekday 7", { weekday: 7 }],
    ["weekday -1", { weekday: -1 }],
    ["hour 24", { hour: 24 }],
    ["minute 60", { minute: 60 }],
    ["fractional hour", { hour: 7.5 }],
    ["unknown zone", { tz: "Mars/Olympus" }],
    ["name over 40", { name: "x".repeat(41) }],
    ["host not in family", { hostId: "stranger" }],
    ["missing host", { hostId: "" }],
  ])("rejects %s", async (_label, patch) => {
    const res = await put("arjun", { ...good, ...patch });
    expect(res.status).toBe(400);
  });

  it("children cannot set it", async () => {
    expect((await put("leo", good)).status).toBe(403);
  });
});
