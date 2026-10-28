import { dbAddCard, dbAddGatherSession, dbAddSuggestion, dbAddWish, dbAssignDailyRole, dbListSuggestions, dbSetRitualRunStatus, dbSetSuggestionStatus } from "@/lib/db";
import { requireSession } from "@/lib/auth";

// Review / Approve: the ONLY place agent proposals become actions.
// Payload actions: create_card | assign_daily_role | request_wish |
// schedule_notification (acknowledge) | create_gather_session | assemble_reel.
export async function POST(req: Request, { params }: { params: { id: string } }): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const all = await dbListSuggestions();
  const found = all.find((s) => s.id === params.id);
  if (!found) return Response.json({ error: "unknown-suggestion" }, { status: 404 });
  if (found.status !== "pending") return Response.json({ error: "already-reviewed", suggestion: found }, { status: 409 });

  let decision = "approve";
  try {
    const body = (await req.json()) as { decision?: unknown };
    if (body.decision === "reject") decision = "reject";
  } catch {
    decision = "approve";
  }
  if (decision === "reject") {
    const updated = await dbSetSuggestionStatus(params.id, "rejected");
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
        familyId: "demo-family",
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
      const memberId = String(args.memberId ?? result.memberId ?? "dadi");
      const prompt = String(args.prompt ?? result.prompt ?? "Bless one grandchild by voice today.");
      const roleDate = String(args.roleDate ?? result.roleDate ?? new Date().toISOString().slice(0, 10));
      await dbAssignDailyRole(memberId, prompt, roleDate);
    } else if (action === "request_wish") {
      const args = (payload.args as Record<string, unknown> | undefined) ?? {};
      const result = (payload.result as Record<string, unknown> | undefined) ?? {};
      const ritualRunId = (args.ritualRunId ?? result.ritualRunId) as string | null;
      const memberId = String(args.memberId ?? result.memberId ?? "");
      const kind = ((args.kind ?? result.kind) as "wish" | "blessing") ?? "wish";
      if (memberId) await dbAddWish({ ritualRunId, memberId, kind });
    } else if (action === "create_gather_session") {
      const args = (payload.args as Record<string, unknown> | undefined) ?? {};
      const result = (payload.result as Record<string, unknown> | undefined) ?? {};
      await dbAddGatherSession({
        title: String(args.title ?? result.title ?? "Family evening"),
        startsAt: String(args.startsAt ?? result.startsAt ?? new Date(Date.now() + 86400000).toISOString()),
      });
    } else if (action === "assemble_reel") {
      const ritualRunId = String((payload.ritualRunId as string | undefined) ?? "");
      if (ritualRunId) await dbSetRitualRunStatus(ritualRunId, "delivered");
      await dbAddSuggestion({
        goal: `Reel ready for ${ritualRunId || "the occasion"}`,
        payload: { action: "reel_ready", ritualRunId },
      });
    }
    // schedule_notification approvals simply acknowledge the reminder.
  } catch {
    return Response.json({ error: "approve-failed" }, { status: 500 });
  }
  const updated = await dbSetSuggestionStatus(params.id, "approved");
  return Response.json({ suggestion: updated ?? { ...found, status: "approved" } });
}
