import { askWeeklyQuestions } from "@/lib/keeper";
import { planRitualScan } from "@/lib/ritual-agent";
import { dbAddAgentRun, dbAddSuggestion, dbAssignDailyRole, dbEnsureRitualRun, dbListFamilyIds, dbListDailyRoles, dbListMembers, dbListRitualRuns, dbListSuggestions, dbListWishes, dbSetRitualRunStatus } from "@/lib/db";
import { familyHolidays } from "@/lib/occasions-server";
import { cronAuthorized, requireSession } from "@/lib/auth";
import { purgeSandboxes } from "@/lib/demo-sandbox";
import { dbFor } from "@/lib/family-db";

// Daily ritual/role scan. Vercel Cron (GET, see vercel.json) hits this with
// Authorization: Bearer CRON_SECRET; manual callers use POST with a session.
// Idempotent — safe to call repeatedly.
export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized-cron" }, { status: 401 });
  // Demo visitors' copies expire after 48 hours (rows and media).
  const sb = dbFor(null);
  const purged = sb ? await purgeSandboxes(sb).catch((e: unknown) => ({ error: String(e) })) : null;
  // Cron covers every family; one family's failure never blocks the others.
  const results = [];
  for (const familyId of await dbListFamilyIds()) {
    try {
      results.push({ familyId, ...(await (await runScan(familyId)).json()) });
    } catch {
      results.push({ familyId, error: "scan-failed" });
    }
  }
  return Response.json({ families: results, purged });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  return runScan(auth.familyId);
}

async function runScan(familyId: string): Promise<Response> {
  const now = new Date();
  const nowISO = now.toISOString();
  const members = await dbListMembers(familyId);
  const [runs, wishes, roles] = await Promise.all([dbListRitualRuns(familyId), dbListWishes(undefined, familyId), dbListDailyRoles(familyId)]);

  // Festivals of the traditions this family celebrates (+ manual overrides);
  // national days are on the calendar but nobody is asked for a wish.
  const fam = await familyHolidays(familyId, members).catch(() => null);
  const festivals = (fam?.visible ?? []).filter((h) => h.kind === "festival");
  const configs = festivals.map((h) => ({ slug: h.key, title: h.title }));
  const movable: Record<string, string> = {};
  for (const h of festivals) {
    // The nearest date per festival from today on (a key can recur yearly).
    if (h.date >= nowISO.slice(0, 10) && (!movable[h.key] || h.date < movable[h.key])) movable[h.key] = h.date;
  }

  const plan = planRitualScan(nowISO, members, configs, movable, { runs, wishes, roles }, familyId);

  for (const r of plan.ensureRuns) await dbEnsureRitualRun(r.slug, r.occasionDate, familyId);
  for (const id of plan.deliverRuns) await dbSetRitualRunStatus(id, "delivered", familyId);
  for (const role of plan.roles) await dbAssignDailyRole(role.memberId, role.prompt, role.roleDate, familyId);
  // Idempotent: a suggestion already made (same goal and payload) is not made again.
  const sig = (goal: string, payload: unknown) => `${goal}|${JSON.stringify(payload ?? {})}`;
  const made = new Set((await dbListSuggestions(undefined, familyId)).map((x) => sig(x.goal, x.payload)));
  const created = [];
  for (const s of plan.suggestions) {
    if (made.has(sig(s.goal, s.payload))) continue;
    made.add(sig(s.goal, s.payload));
    created.push(await dbAddSuggestion({ goal: s.goal, payload: s.payload, familyId }));
  }
  // Story keeper: one gentle question per elder per week (idempotent).
  const questions = await askWeeklyQuestions(familyId, members, now).catch(() => []);
  await dbAddAgentRun({
    familyId,
    goal: `Ritual scan ${nowISO.slice(0, 10)}`,
    tools: ["read_family_graph", "request_wish", "schedule_notification", "assign_daily_role", ...(questions.length ? ["ask_elder_question"] : [])],
    status: "done",
  });
  return Response.json({
    date: nowISO.slice(0, 10),
    runsEnsured: plan.ensureRuns.length,
    runsDelivered: plan.deliverRuns.length,
    rolesAssigned: plan.roles.length,
    suggestions: created.length,
    questionsAsked: questions.length,
  });
}
