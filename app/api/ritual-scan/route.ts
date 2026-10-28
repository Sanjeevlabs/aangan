import { readFileSync } from "fs";
import { join } from "path";
import { planRitualScan } from "@/lib/ritual-agent";
import { dbAddAgentRun, dbAddSuggestion, dbAssignDailyRole, dbEnsureRitualRun, dbGetMovableDate, dbListFamilyIds, dbListDailyRoles, dbListMembers, dbListRitualRuns, dbListWishes, dbSetMovableDate, dbSetRitualRunStatus } from "@/lib/db";
import { resolveMovableDates } from "@/lib/movable-dates";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { loadRitualConfig } from "@/lib/rituals";
import { cronAuthorized, requireSession } from "@/lib/auth";

// Daily ritual/role scan. Vercel Cron (GET, see vercel.json) hits this with
// Authorization: Bearer CRON_SECRET; manual callers use POST with a session.
// Idempotent — safe to call repeatedly.
export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized-cron" }, { status: 401 });
  // Cron covers every family; one family's failure never blocks the others.
  const results = [];
  for (const familyId of await dbListFamilyIds()) {
    try {
      results.push({ familyId, ...(await (await runScan(familyId)).json()) });
    } catch {
      results.push({ familyId, error: "scan-failed" });
    }
  }
  return Response.json({ families: results });
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  return runScan(auth.familyId);
}

async function runScan(familyId: string): Promise<Response> {
  const now = new Date();
  const nowISO = now.toISOString();
  const members = await dbListMembers(familyId);
  const [runs, wishes, roles] = await Promise.all([dbListRitualRuns(familyId), dbListWishes(undefined, familyId), dbListDailyRoles(familyId)]);

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
  let fixture: Record<string, string> = {};
  try {
    fixture = (JSON.parse(readFileSync(join(process.cwd(), "data", "movable-dates.json"), "utf8")) as { dates: Record<string, string> }).dates ?? {};
  } catch {
    fixture = {};
  }
  const { dates: movable } = await resolveMovableDates(
    configs.filter((c) => c.slug !== "birthday"),
    now,
    {
      store: serverStore,
      ledger: serverLedger,
      getPersistent: (slug, year) => dbGetMovableDate(slug, year),
      setPersistent: (slug, year, date, sources) => dbSetMovableDate(slug, year, date, sources),
      fixture: (slug) => fixture[slug] ?? null,
    },
  );

  const plan = planRitualScan(nowISO, members, configs, movable, { runs, wishes, roles }, familyId);

  for (const r of plan.ensureRuns) await dbEnsureRitualRun(r.slug, r.occasionDate, familyId);
  for (const id of plan.deliverRuns) await dbSetRitualRunStatus(id, "delivered");
  for (const role of plan.roles) await dbAssignDailyRole(role.memberId, role.prompt, role.roleDate, familyId);
  const created = [];
  for (const s of plan.suggestions) created.push(await dbAddSuggestion({ goal: s.goal, payload: s.payload, familyId }));
  await dbAddAgentRun({
    familyId,
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
