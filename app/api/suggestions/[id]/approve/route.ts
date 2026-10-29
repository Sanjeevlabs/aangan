import { dbAddCard, dbAddGatherSession, dbAddSuggestion, dbAddWish, dbAssignDailyRole, dbGetMember, dbListMembers, dbListRitualRuns, dbListSuggestions, dbSetRitualRunStatus, dbSetSuggestionStatus } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// Review / Approve: the ONLY place agent proposals become actions.
// Payload actions: create_card | assign_daily_role | request_wish |
// schedule_notification (acknowledge) | create_gather_session | assemble_reel.
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const all = await dbListSuggestions(undefined, auth.familyId);
  const found = all.find((s) => s.id === params.id);
  if (!found) return Response.json({ error: "unknown-suggestion" }, { status: 404 });
  if (found.status !== "pending") return Response.json({ error: "already-reviewed", suggestion: found }, { status: 409 });
  // Approving makes things happen for the whole family: grown-ups only.
  const me = await dbGetMember(auth.memberId);
  if (!me || me.familyId !== auth.familyId || me.access === "child" || me.role === "child") return Response.json({ error: "grown-ups-only" }, { status: 403 });
  const familyId = auth.familyId;
  const members = await dbListMembers(familyId);
  const inFamily = (id: string) => members.some((m) => m.id === id);
  const runs = await dbListRitualRuns(familyId);
  const ownRun = (id: string | null) => id === null || runs.some((r) => r.id === id);

  let decision = "approve";
  try {
    const body = (await req.json()) as { decision?: unknown };
    if (body.decision === "reject") decision = "reject";
  } catch {
    decision = "approve";
  }
  if (decision === "reject") {
    const updated = await dbSetSuggestionStatus(params.id, "rejected", familyId);
    return Response.json({ suggestion: updated ?? { ...found, status: "rejected" } });
  }

  const payload = (found.payload ?? {}) as Record<string, unknown>;
  const action = typeof payload.action === "string" ? payload.action : "";
  try {
    if (action === "create_card") {
      const card = (payload.result as { card?: Record<string, unknown> } | undefined)?.card
        ?? (payload.card as Record<string, unknown> | undefined)
        ?? (payload.args as Record<string, unknown> | undefined);
      await dbAddCard({
        familyId,
        type: (card?.type as "photo" | "audio" | "video") ?? "photo",
        caption: String(card?.caption ?? "A family memory, saved by Aangan."),
        lang: String(card?.lang ?? "en"),
        takenAt: new Date().toISOString(),
        ritualSlug: null,
        source: "agent",
      });
    } else if (action === "assign_daily_role") {
      const args = (payload.args as Record<string, unknown> | undefined) ?? {};
      const result = (payload.result as Record<string, unknown> | undefined) ?? {};
      const memberId = String(args.memberId ?? result.memberId ?? "");
      if (!inFamily(memberId)) return Response.json({ error: "unknown-member" }, { status: 400 });
      const prompt = String(args.prompt ?? result.prompt ?? "Bless one grandchild by voice today.");
      const roleDate = String(args.roleDate ?? result.roleDate ?? new Date().toISOString().slice(0, 10));
      await dbAssignDailyRole(memberId, prompt.slice(0, 280), roleDate.slice(0, 10), familyId);
    } else if (action === "request_wish") {
      const args = (payload.args as Record<string, unknown> | undefined) ?? {};
      const result = (payload.result as Record<string, unknown> | undefined) ?? {};
      const ritualRunId = (args.ritualRunId ?? result.ritualRunId) as string | null;
      const memberId = String(args.memberId ?? result.memberId ?? "");
      const kind = ((args.kind ?? result.kind) as "wish" | "blessing") ?? "wish";
      if (!inFamily(memberId) || !ownRun(ritualRunId ?? null)) return Response.json({ error: "unknown-member" }, { status: 400 });
      await dbAddWish({ ritualRunId: ritualRunId ?? null, memberId, kind: kind === "blessing" ? "blessing" : "wish", familyId });
    } else if (action === "create_gather_session") {
      const args = (payload.args as Record<string, unknown> | undefined) ?? {};
      const result = (payload.result as Record<string, unknown> | undefined) ?? {};
      await dbAddGatherSession({
        familyId,
        title: String(args.title ?? result.title ?? "Family evening").slice(0, 80),
        startsAt: String(args.startsAt ?? result.startsAt ?? new Date(Date.now() + 86400000).toISOString()),
      });
    } else if (action === "assemble_reel") {
      const ritualRunId = String((payload.ritualRunId as string | undefined) ?? "");
      if (ritualRunId && !ownRun(ritualRunId)) return Response.json({ error: "unknown-run" }, { status: 400 });
      if (ritualRunId) await dbSetRitualRunStatus(ritualRunId, "delivered", familyId);
      await dbAddSuggestion({
        familyId,
        goal: `Reel ready for ${ritualRunId || "the occasion"}`,
        payload: { action: "reel_ready", ritualRunId },
      });
    }
    // schedule_notification approvals simply acknowledge the reminder.
  } catch {
    return Response.json({ error: "approve-failed" }, { status: 500 });
  }
  const updated = await dbSetSuggestionStatus(params.id, "approved", familyId);
  return Response.json({ suggestion: updated ?? { ...found, status: "approved" } });
}
