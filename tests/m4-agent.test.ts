import { beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "@/lib/agent";
import { agentTools } from "@/lib/agent-tools";
import { planRitualScan } from "@/lib/ritual-agent";
import { DEMO_MEMBERS } from "@/lib/family";
import { MemberSchema } from "@/lib/schemas";
import { listCards, resetDemo } from "@/lib/store";
import { authedGet, authedJson, sessionCookie } from "./auth-helper";
import { POST as scanPOST } from "@/app/api/ritual-scan/route";
import { GET as suggGET, POST as suggPOST } from "@/app/api/suggestions/route";
import { POST as approvePOST } from "@/app/api/suggestions/[id]/approve/route";

const members = DEMO_MEMBERS.map((m) => MemberSchema.parse(m));

describe("runAgent (mock planner)", () => {
  beforeEach(() => resetDemo());

  it("maps a role goal to assign_daily_role and never writes directly", async () => {
    const before = listCards().length;
    const result = await runAgent("Bless Leo's exam with a daily role for Dadi", agentTools("demo-family"));
    expect(result.status).toBe("done");
    expect(result.toolCalls.map((c) => c.name)).toContain("assign_daily_role");
    expect(result.suggestions.length).toBeGreaterThan(0);
    // Agents propose; they never persist cards themselves.
    expect(listCards().length).toBe(before);
  });

  it("maps wish/reel goals to request_wish and gather goals to sessions", async () => {
    const wish = await runAgent("Collect birthday wishes for the reel", agentTools("demo-family"));
    expect(wish.toolCalls[0]?.name).toBe("request_wish");

    const gather = await runAgent("Plan a family evening together with a playlist", agentTools("demo-family"));
    expect(gather.toolCalls[0]?.name).toBe("create_gather_session");
  });
});

describe("planRitualScan (pure)", () => {
  it("requests wishes + blessings 7 days out and assigns elder roles", () => {
    // Leo's birthday is 11-09; 6 days before -> collect.
    const plan = planRitualScan("2026-11-03T10:00:00.000Z", members, [], {}, { runs: [], wishes: [], roles: [] });
    expect(plan.ensureRuns).toEqual([{ slug: "birthday", occasionDate: "2026-11-09" }]);
    expect(plan.suggestions.length).toBeGreaterThan(0);
    // Every grown-up is asked (elders for a blessing), never the child accounts or Leo.
    const asked = plan.suggestions.map((s) => s.payload as { memberId?: string; kind?: string });
    expect(asked.find((p) => p.memberId === "dadi")?.kind).toBe("blessing");
    expect(asked.find((p) => p.memberId === "arjun")?.kind).toBe("wish");
    expect(asked.some((p) => p.memberId === "leo" || p.memberId === "aria")).toBe(false);
    expect(plan.suggestions[0].goal).toMatch(/^Record a (wish|blessing) for Vihaan's birthday$/);
    // Still asked when the run is already open (the Occasions page opens runs early).
    const run = { id: "birthday:2026-11-09", familyId: "demo-family", ritualSlug: "birthday", occasionDate: "2026-11-09", status: "open" as const, createdAt: "2026-11-01T00:00:00.000Z" };
    expect(planRitualScan("2026-11-03T10:00:00.000Z", members, [], {}, { runs: [run], wishes: [], roles: [] }).suggestions.length).toBe(plan.suggestions.length);
    // Elder daily role for today.
    // Both grandparents get a daily role.
    expect(plan.roles.map((r) => r.memberId).sort()).toEqual(["dada", "dadi"]);
    expect(plan.roles[0].roleDate).toBe("2026-11-03");
  });

  it("reminds the missing at day 3 and delivers on the day", () => {
    const run = {
      id: "birthday:2026-11-09",
      familyId: "demo-family",
      ritualSlug: "birthday",
      occasionDate: "2026-11-09",
      status: "collecting" as const,
      createdAt: "2026-11-06T00:00:00.000Z",
    };
    const day3 = planRitualScan("2026-11-06T10:00:00.000Z", members, [], {}, { runs: [run], wishes: [], roles: [] });
    expect(day3.ensureRuns).toHaveLength(0);
    expect(day3.suggestions.some((s) => String((s.payload as { action?: string }).action) === "schedule_notification")).toBe(true);

    const today = planRitualScan("2026-11-09T06:00:00.000Z", members, [], {}, { runs: [run], wishes: [], roles: [] });
    expect(today.deliverRuns).toEqual(["birthday:2026-11-09"]);
    expect(today.suggestions.some((s) => String((s.payload as { action?: string }).action) === "assemble_reel")).toBe(true);
  });

  it("counts 'today' in the celebrant's own timezone", () => {
    const run = { id: "birthday:2026-11-09", familyId: "demo-family", ritualSlug: "birthday", occasionDate: "2026-11-09", status: "collecting" as const, createdAt: "2026-11-06T00:00:00.000Z" };
    const at = "2026-11-09T06:00:00.000Z"; // 11:30 on the 9th in Kolkata, 20:00 on the 8th at UTC-10
    const kolkata = planRitualScan(at, members, [], {}, { runs: [run], wishes: [], roles: [] });
    expect(kolkata.deliverRuns).toEqual(["birthday:2026-11-09"]);
    const honolulu = members.map((m) => (m.id === "leo" ? { ...m, tz: "Pacific/Honolulu" } : m));
    const plan = planRitualScan(at, honolulu, [], {}, { runs: [run], wishes: [], roles: [] });
    expect(plan.deliverRuns).toEqual([]); // still the 8th for Vihaan: not the reel yet
    expect(plan.suggestions.some((s) => String((s.payload as { action?: string }).action) === "assemble_reel")).toBe(false);
    // The next day's scan at the same hour is his birthday.
    expect(planRitualScan("2026-11-09T12:00:00.000Z", honolulu, [], {}, { runs: [run], wishes: [], roles: [] }).deliverRuns).toEqual(["birthday:2026-11-09"]);
  });

  it("uses the movable-date fixture for config occasions", () => {
    const plan = planRitualScan(
      "2026-11-03T10:00:00.000Z",
      members,
      [{ slug: "diwali", title: "Diwali guide" }],
      { diwali: "2026-11-08" },
      { runs: [], wishes: [], roles: [] },
    );
    expect(plan.ensureRuns).toContainEqual({ slug: "diwali", occasionDate: "2026-11-08" });
  });
});

describe("ritual-scan + suggestions API (mock store)", () => {
  beforeEach(() => resetDemo());

  it("scan assigns elder roles and suggest->approve executes once", async () => {
    // Date-independent: whatever today is, elders always get a daily role.
    const first = (await (await scanPOST(authedJson("http://test/api/ritual-scan", {}))).json()) as { runsEnsured: number; suggestions: number; rolesAssigned: number };
    expect(first.rolesAssigned).toBeGreaterThan(0);

    // Agent-created suggestion with an explicit goal persists, then
    // approving it executes the drafted role exactly once.
    const created = await suggPOST(
      authedJson("http://test/api/suggestions", { goal: "Teach Aria one word today", payload: {} }),
    );
    expect(created.status).toBe(201);

    const pending = (await (await suggGET(authedGet("http://test/api/suggestions?status=pending"))).json()) as {
      suggestions: { id: string; goal: string; payload: { action?: string } }[];
    };
    expect(pending.suggestions.length).toBeGreaterThan(0);

    const target = pending.suggestions[0];
    const approved = await approvePOST(
      new Request("http://test/api/approve", { method: "POST", headers: { cookie: sessionCookie() } }),
      {
        params: Promise.resolve({ id: target.id }),
      },
    );
    expect(approved.status).toBe(200);

    const again = await approvePOST(
      new Request("http://test/api/approve", { method: "POST", headers: { cookie: sessionCookie() } }),
      {
        params: Promise.resolve({ id: target.id }),
      },
    );
    expect(again.status).toBe(409);
  });
});
