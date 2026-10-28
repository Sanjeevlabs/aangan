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
    const result = await runAgent("Bless Leo's exam with a daily role for Dadi", agentTools());
    expect(result.status).toBe("done");
    expect(result.toolCalls.map((c) => c.name)).toContain("assign_daily_role");
    expect(result.suggestions.length).toBeGreaterThan(0);
    // Agents propose; they never persist cards themselves.
    expect(listCards().length).toBe(before);
  });

  it("maps wish/reel goals to request_wish and gather goals to sessions", async () => {
    const wish = await runAgent("Collect birthday wishes for the reel", agentTools());
    expect(wish.toolCalls[0]?.name).toBe("request_wish");

    const gather = await runAgent("Plan a family evening together with a playlist", agentTools());
    expect(gather.toolCalls[0]?.name).toBe("create_gather_session");
  });
});

describe("planRitualScan (pure)", () => {
  it("requests wishes + blessings 7 days out and assigns elder roles", () => {
    // Leo's birthday is 11-09; 6 days before -> collect.
    const plan = planRitualScan("2026-11-03T10:00:00.000Z", members, [], {}, { runs: [], wishes: [], roles: [] });
    expect(plan.ensureRuns).toEqual([{ slug: "birthday", occasionDate: "2026-11-09" }]);
    expect(plan.suggestions.length).toBeGreaterThan(0);
    // Blessings come from elders (dadi), wishes from the rest (minus Leo).
    expect(plan.suggestions.some((s) => String(s.goal).includes("Dadi"))).toBe(true);
    // Elder daily role for today.
    expect(plan.roles).toHaveLength(1);
    expect(plan.roles[0].memberId).toBe("dadi");
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
        params: { id: target.id },
      },
    );
    expect(approved.status).toBe(200);

    const again = await approvePOST(
      new Request("http://test/api/approve", { method: "POST", headers: { cookie: sessionCookie() } }),
      {
        params: { id: target.id },
      },
    );
    expect(again.status).toBe(409);
  });
});
