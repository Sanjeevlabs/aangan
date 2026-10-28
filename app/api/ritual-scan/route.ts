import { readFileSync } from "fs";
import { join } from "path";
import { planRitualScan } from "@/lib/ritual-agent";
import { dbAddAgentRun, dbAddSuggestion, dbAssignDailyRole, dbEnsureRitualRun, dbListDailyRoles, dbListMembers, dbListRitualRuns, dbListWishes, dbSetRitualRunStatus } from "@/lib/db";
import { loadRitualConfig } from "@/lib/rituals";

// Daily ritual/role scan. Vercel Cron hits this once a day; it is also safe
// to call manually. Pure planning in lib/ritual-agent.ts, execution here.
export async function POST(): Promise<Response> {
  const now = new Date();
  const nowISO = now.toISOString();
  const members = await dbListMembers();
  const [runs, wishes, roles] = await Promise.all([dbListRitualRuns(), dbListWishes(), dbListDailyRoles()]);

  const configs: { slug: string; title: string }[] = [];
  try {
    const { readdirSync } = await import("fs");
    for (const name of readdirSync(join(process.cwd(), "rituals"))) {
      if (!name.endsWith(".json")) continue;
      const c = loadRitualConfig(JSON.parse(readFileSync(join(process.cwd(), "rituals", name), "utf8")));
      configs.push({ slug: c.slug, title: c.title });
    }
  } catch {
    // Configs optional; birthdays still scan.
  }
  let movable: Record<string, string> = {};
  try {
    movable = (JSON.parse(readFileSync(join(process.cwd(), "data", "movable-dates.json"), "utf8")) as { dates: Record<string, string> }).dates ?? {};
  } catch {
    movable = {};
  }

  const plan = planRitualScan(nowISO, members, configs, movable, { runs, wishes, roles });

  for (const r of plan.ensureRuns) await dbEnsureRitualRun(r.slug, r.occasionDate);
  for (const id of plan.deliverRuns) await dbSetRitualRunStatus(id, "delivered");
  for (const role of plan.roles) await dbAssignDailyRole(role.memberId, role.prompt, role.roleDate);
  const created = [];
  for (const s of plan.suggestions) created.push(await dbAddSuggestion({ goal: s.goal, payload: s.payload }));
  await dbAddAgentRun({
    goal: `Ritual scan ${nowISO.slice(0, 10)}`,
    tools: ["read_family_graph", "request_wish", "schedule_notification", "assign_daily_role"],
    status: "done",
  });
  return Response.json({
    date: nowISO.slice(0, 10),
    runsEnsured: plan.ensureRuns.length,
    runsDelivered: plan.deliverRuns.length,
    rolesAssigned: plan.roles.length,
    suggestions: created.length,
  });
}
