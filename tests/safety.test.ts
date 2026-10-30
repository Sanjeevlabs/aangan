import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/safety/route";
import type { SafetyCheckin } from "@/lib/kinds";
import { emergencyFor, stateOf, withoutStaleLocation } from "@/lib/safety";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (member: string, body?: unknown) =>
  new Request("http://test/api/safety", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;
type Data = { mine: { watchers: string[]; enabled: boolean } | null; sharing: string[]; checkins: SafetyCheckin[] };

beforeEach(() => resetDemo());

const base = { id: "c", memberId: "aria", note: "", closedAt: null, location: null } as const;

describe("safety state", () => {
  it("is calm, pending, then overdue only after the grace period", () => {
    const at = "2026-10-28T20:00:00.000Z";
    const eta = "2026-10-28T20:30:00.000Z";
    const c: SafetyCheckin = { ...base, kind: "heading", etaAt: eta, at };
    expect(stateOf([c], "aria", Date.parse("2026-10-28T20:40:00Z"))?.tone).toBe("pending");
    expect(stateOf([c], "aria", Date.parse("2026-10-28T20:51:00Z"))?.tone).toBe("overdue");
    expect(stateOf([{ ...c, closedAt: "2026-10-28T20:35:00Z" }], "aria", Date.parse("2026-10-28T22:00:00Z"))).toMatchObject({ tone: "calm", label: "Home safe" });
    expect(stateOf([], "aria")).toBeNull();
  });

  it("drops a location after 24 hours", () => {
    const c: SafetyCheckin = { ...base, kind: "help", etaAt: null, at: "2026-10-27T00:00:00Z", location: { lat: 12.97, lng: 77.59, accuracy: 20, at: "2026-10-27T00:00:00Z" } };
    expect(withoutStaleLocation(c, Date.parse("2026-10-27T12:00:00Z")).location).not.toBeNull();
    expect(withoutStaleLocation(c, Date.parse("2026-10-28T01:00:00Z")).location).toBeNull();
  });

  it("knows emergency numbers by time zone", () => {
    expect(emergencyFor("Asia/Kolkata").number).toBe("112");
    expect(emergencyFor("America/Chicago").number).toBe("911");
    expect(emergencyFor("Europe/London").number).toBe("999");
    expect(emergencyFor("Australia/Sydney").number).toBe("000");
    expect(emergencyFor("Antarctica/Troll").number).toBe("112");
  });
});

describe("safe & sound api", () => {
  it("only the people she chose see her check-ins", async () => {
    const arjun = await json<Data>(GET(req("arjun")));
    expect(arjun.sharing).toContain("dada");
    expect(arjun.checkins.some((c) => c.memberId === "dada")).toBe(true);
    const leo = await json<Data>(GET(req("leo")));
    expect(leo.sharing).not.toContain("dada");
    expect(leo.checkins.some((c) => c.memberId === "dada")).toBe(false);
  });

  it("pausing hides everything; turning on needs at least one person", async () => {
    expect((await POST(req("leo", { action: "settings", enabled: true, watchers: [] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "settings", enabled: true, watchers: ["stranger"] }))).status).toBe(400);
    await POST(req("aria", { action: "settings", enabled: true, watchers: ["arjun"], paused: true }));
    const arjun = await json<Data>(GET(req("arjun")));
    expect(arjun.sharing).not.toContain("aria");
    const dadi = await json<Data>(GET(req("dadi")));
    expect(dadi.sharing).not.toContain("aria");
  });

  it("can't check in until it's on, and a new check-in closes the open one", async () => {
    expect((await POST(req("leo", { action: "checkin", kind: "home-safe" }))).status).toBe(409);
    await POST(req("leo", { action: "settings", enabled: true, watchers: ["arjun"] }));
    const heading = await json<{ checkin: SafetyCheckin }>(POST(req("leo", { action: "checkin", kind: "heading", etaMinutes: 30, note: "From practice" })));
    expect(heading.checkin.etaAt).not.toBeNull();
    expect(heading.checkin.closedAt).toBeNull();
    let seen = await json<Data>(GET(req("arjun")));
    expect(stateOf(seen.checkins, "leo")?.tone).toBe("pending");
    await POST(req("leo", { action: "checkin", kind: "home-safe" }));
    seen = await json<Data>(GET(req("arjun")));
    expect(stateOf(seen.checkins, "leo")).toMatchObject({ tone: "calm", label: "Home safe" });
    expect(seen.checkins.find((c) => c.id === heading.checkin.id)?.closedAt).not.toBeNull();
  });

  it("accepts a location only with I need help, and clears it when she's okay", async () => {
    await POST(req("leo", { action: "settings", enabled: true, watchers: ["arjun"] }));
    const loc = { lat: 41.88, lng: -87.63, accuracy: 15 };
    const late = await json<{ checkin: SafetyCheckin }>(POST(req("leo", { action: "checkin", kind: "out-late", location: loc })));
    expect(late.checkin.location).toBeNull();
    const help = await json<{ checkin: SafetyCheckin }>(POST(req("leo", { action: "checkin", kind: "help", location: loc })));
    expect(help.checkin.location).toMatchObject({ lat: 41.88 });
    expect(stateOf((await json<Data>(GET(req("arjun")))).checkins, "leo")?.tone).toBe("help");
    expect((await POST(req("arjun", { action: "close", checkinId: help.checkin.id }))).status).toBe(409);
    const ok = await json<{ checkin: SafetyCheckin }>(POST(req("leo", { action: "close", checkinId: help.checkin.id })));
    expect(ok.checkin).toMatchObject({ location: null });
    expect(ok.checkin.closedAt).not.toBeNull();
  });
});
