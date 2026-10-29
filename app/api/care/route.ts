import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { needFromVoice, noteForParent } from "@/lib/care";
import { dbAddAgentRun, dbListCards, dbListMembers, dbListRelationships } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { householdOf, households } from "@/lib/households";
import { HELPER_ROLES, NEED_KINDS, NEED_STATUSES, PRIORITIES, RECURRENCE, type Need } from "@/lib/kinds";
import { can } from "@/lib/permissions";
import type { Member } from "@/lib/schemas";

// Care board: tickets for each home (open → assigned → in progress → done,
// or cancelled), the home's local helpers (trusted people nearby), whose week it
// is, and who handles what. Every change is written to the ticket's
// timeline. Tasks only: no medical, legal or financial advice anywhere.

const NEED_LABEL_EN: Record<(typeof NEED_KINDS)[number], string> = {
  groceries: "groceries",
  house: "the house",
  ride: "rides",
  repair: "repairs",
  gas: "the gas booking",
  bills: "the bills",
  health: "health visits",
  errand: "errands",
  visit: "visits",
  pets: "the pets",
  other: "this",
};

const When = z.string().trim().max(60).default("");
const DueAt = z.string().datetime().nullable().optional();
const Phone = z.string().trim().max(30).regex(/^[+\d\s()-]*$/).default("");

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("need"),
    forMemberId: z.string().min(1),
    title: z.string().trim().min(3).max(120),
    kind: z.enum(NEED_KINDS).default("other"),
    when: When,
    priority: z.enum(PRIORITIES).default("normal"),
    dueAt: DueAt,
    recurring: z.enum(RECURRENCE).default("none"),
    petId: z.string().nullable().optional(),
    assignee: z.string().nullable().optional(),
  }),
  z.object({ action: z.literal("need-from-voice"), cardId: z.string().min(1), forMemberId: z.string().min(1) }),
  z.object({ action: z.literal("claim"), needId: z.string().min(1) }),
  // Assign to any family member (siblings split the work).
  z.object({ action: z.literal("assign-to"), needId: z.string().min(1), memberId: z.string().min(1) }),
  // The local helper who will actually go.
  z.object({ action: z.literal("assign"), needId: z.string().min(1), helperId: z.string().min(1) }),
  z.object({ action: z.literal("status"), needId: z.string().min(1), status: z.enum(NEED_STATUSES) }),
  z.object({ action: z.literal("done"), needId: z.string().min(1) }),
  z.object({ action: z.literal("reopen"), needId: z.string().min(1) }),
  z.object({
    action: z.literal("need-edit"),
    needId: z.string().min(1),
    title: z.string().trim().min(3).max(120),
    kind: z.enum(NEED_KINDS),
    when: When,
    priority: z.enum(PRIORITIES).optional(),
    dueAt: DueAt,
    recurring: z.enum(RECURRENCE).optional(),
  }),
  z.object({ action: z.literal("need-delete"), needId: z.string().min(1) }),
  z.object({ action: z.literal("helper"), forMemberId: z.string().min(1), name: z.string().trim().min(1).max(60), role: z.enum(HELPER_ROLES).default("other"), phone: Phone, hours: z.string().trim().max(60).default(""), note: z.string().trim().max(160).default("") }),
  z.object({ action: z.literal("helper-edit"), helperId: z.string().min(1), name: z.string().trim().min(1).max(60), role: z.enum(HELPER_ROLES), phone: Phone, hours: z.string().trim().max(60).default(""), note: z.string().trim().max(160).default("") }),
  z.object({ action: z.literal("helper-remove"), helperId: z.string().min(1) }),
  z.object({ action: z.literal("duty-set"), forMemberId: z.string().min(1), kind: z.enum(NEED_KINDS), memberId: z.string().min(1) }),
  z.object({ action: z.literal("duty-clear"), forMemberId: z.string().min(1), kind: z.enum(NEED_KINDS) }),
  z.object({ action: z.literal("take-week"), forMemberId: z.string().min(1) }),
  z.object({ action: z.literal("leave-rota"), forMemberId: z.string().min(1) }),
]);

// Anyone may ask for themselves and edit or withdraw their own tickets;
// running care (assigning, local helpers, the rota, duties) needs care.manage.
const SELF_SERVICE = new Set(["need", "need-from-voice", "need-edit", "need-delete"]);

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const [needs, helpers, rotas, duties] = await Promise.all([listDocs(auth.familyId, "need"), listDocs(auth.familyId, "helper"), listDocs(auth.familyId, "rota"), listDocs(auth.familyId, "duty")]);
  return Response.json({ needs, helpers, rotas, duties });
}

function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

function nextDue(from: string | null, recurring: Need["recurring"]): string | null {
  if (recurring === "none") return null;
  const d = from ? new Date(from) : new Date();
  if (recurring === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-care" }, { status: 400 });
  const body = parsed.data;
  const members = await dbListMembers(auth.familyId);
  const person = (id: string | null | undefined): Member | undefined => members.find((m) => m.id === id);
  const me = person(auth.memberId);
  const now = new Date().toISOString();

  if (!SELF_SERVICE.has(body.action) && !can(me, "care.manage")) return Response.json({ error: "not-allowed", action: "care.manage" }, { status: 403 });
  const askingForSelf = "forMemberId" in body && body.forMemberId === auth.memberId;
  if ((body.action === "need" || body.action === "need-from-voice") && !askingForSelf && !can(me, "care.manage")) return Response.json({ error: "not-allowed", action: "care.manage" }, { status: 403 });

  const loadNeed = async (id: string): Promise<Need | Response> => (await getDoc(auth.familyId, "need", id)) ?? Response.json({ error: "unknown-need" }, { status: 404 });
  const reassure = async (need: Need, english: string) => {
    const parent = person(need.forMemberId);
    return parent ? noteForParent(auth.familyId, parent, english) : english;
  };
  /** Save with one more line on the ticket's timeline. */
  const save = (need: Need, what: string, patch: Partial<Need> = {}) =>
    putDoc(auth.familyId, "need", { ...need, ...patch, history: [...need.history, { at: now, by: auth.memberId, what }].slice(-100) });
  const homeIdsOf = async (memberId: string): Promise<Set<string>> => {
    const home = householdOf(memberId, households(members, await dbListRelationships(auth.familyId)));
    return new Set([memberId, ...(home?.members.map((m) => m.id) ?? [])]);
  };

  // Who handles this kind of need for this home? Then it goes straight to them.
  const routeToDuty = async (need: Need): Promise<Need> => {
    if (need.claimedBy) return need;
    const homeIds = await homeIdsOf(need.forMemberId);
    const duty = (await listDocs(auth.familyId, "duty")).find((d) => homeIds.has(d.forMemberId) && d.kind === need.kind);
    const who = duty && person(duty.memberId);
    if (!who) return need;
    const noteForParent = await reassure(need, `${who.displayName} looks after ${NEED_LABEL_EN[need.kind]} for you. They're on it.`);
    return save(need, `Assigned to ${who.displayName} (handles ${NEED_LABEL_EN[need.kind]})`, { status: "claimed", claimedBy: who.id, noteForParent });
  };

  switch (body.action) {
    case "need": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const assignee = body.assignee ? person(body.assignee) : undefined;
      const need = await putDoc(auth.familyId, "need", {
        id: newId("need"),
        forMemberId: body.forMemberId,
        askedBy: auth.memberId,
        title: body.title,
        kind: body.kind,
        when: body.when,
        priority: body.priority,
        dueAt: body.dueAt ?? null,
        recurring: body.recurring,
        petId: body.petId ?? null,
        status: assignee ? "claimed" : "open",
        claimedBy: assignee?.id ?? null,
        history: [{ at: now, by: auth.memberId, what: assignee ? `Created and assigned to ${assignee.displayName}` : "Created" }],
        createdAt: now,
      });
      return Response.json({ need: await routeToDuty(need) }, { status: 201 });
    }
    case "need-from-voice": {
      const parent = person(body.forMemberId);
      const card = (await dbListCards(auth.familyId)).find((c) => c.id === body.cardId);
      if (!parent || !card) return Response.json({ error: "unknown" }, { status: 404 });
      const draft = await needFromVoice(auth.familyId, parent.displayName, card.transcript || card.caption, card.transcriptLang || card.lang);
      const need = await putDoc(auth.familyId, "need", { id: newId("need"), forMemberId: parent.id, askedBy: auth.memberId, ...draft, status: "open", history: [{ at: now, by: auth.memberId, what: "Asked by voice (written down by Muse)" }], createdAt: now });
      await dbAddAgentRun({ goal: `Care: turned ${parent.displayName}'s voice into a task`, tools: ["muse-voice-transcribe", "muse-spark", "create_need"], familyId: auth.familyId });
      return Response.json({ need: await routeToDuty(need) }, { status: 201 });
    }
    case "claim":
    case "assign-to": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      const who = person(body.action === "claim" ? auth.memberId : body.memberId);
      if (!who || who.access === "child") return Response.json({ error: "unknown-member" }, { status: 404 });
      const noteForParent = await reassure(need, `${who.displayName} is taking care of it.`);
      const what = body.action === "claim" ? `${who.displayName} took it` : `${me?.displayName ?? "Family"} assigned it to ${who.displayName}`;
      return Response.json({ need: await save(need, what, { status: need.status === "progress" ? "progress" : "claimed", claimedBy: who.id, noteForParent }) });
    }
    case "assign": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      const helper = await getDoc(auth.familyId, "helper", body.helperId);
      // A helper serves the whole home (Maa's grocer is Papa's grocer too).
      if (!helper || !(await homeIdsOf(need.forMemberId)).has(helper.forMemberId)) return Response.json({ error: "unknown-helper" }, { status: 404 });
      const english = `${helper.name} will help${need.when ? ` (${need.when})` : ""}. ${me?.displayName ?? "Family"} arranged it.`;
      return Response.json({ need: await save(need, `${helper.name} (${helper.role}) will go`, { status: need.status === "open" ? "claimed" : need.status, claimedBy: need.claimedBy ?? auth.memberId, helperId: helper.id, noteForParent: await reassure(need, english) }) });
    }
    case "status":
    case "done":
    case "reopen": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      const status = body.action === "done" ? "done" : body.action === "reopen" ? "open" : body.status;
      const label: Record<Need["status"], string> = { open: "Re-opened", claimed: "Assigned", progress: "Started", done: "Done", cancelled: "Cancelled" };
      const patch: Partial<Need> =
        status === "open"
          ? { status, claimedBy: null, helperId: null, noteForParent: "", doneAt: null }
          : status === "done"
            ? { status, claimedBy: need.claimedBy ?? auth.memberId, doneAt: now }
            : { status };
      const saved = await save(need, label[status], patch);
      // A recurring task rolls forward: the next one is created, open, with the same people.
      let next: Need | null = null;
      if (status === "done" && need.recurring !== "none") {
        next = await putDoc(auth.familyId, "need", {
          ...need,
          id: newId("need"),
          status: need.claimedBy ? "claimed" : "open",
          dueAt: nextDue(need.dueAt, need.recurring),
          doneAt: null,
          noteForParent: "",
          history: [{ at: now, by: auth.memberId, what: `Repeats ${need.recurring}: created after the last one was done` }],
          createdAt: now,
        });
      }
      return Response.json({ need: saved, next });
    }
    case "need-edit":
    case "need-delete": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      const mine = need.askedBy === auth.memberId || need.forMemberId === auth.memberId;
      if (!mine && !can(me, "care.manage")) return Response.json({ error: "not-yours" }, { status: 403 });
      if (body.action === "need-delete") {
        await deleteDoc(auth.familyId, "need", need.id);
        return Response.json({ deleted: need.id });
      }
      const { action: _a, needId: _n, ...fields } = body;
      void _a;
      void _n;
      return Response.json({ need: await save(need, "Edited", { ...fields, dueAt: fields.dueAt === undefined ? need.dueAt : fields.dueAt }) });
    }
    case "helper": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const { action: _a, ...rest } = body;
      void _a;
      return Response.json({ helper: await putDoc(auth.familyId, "helper", { id: newId("helper"), ...rest, addedBy: auth.memberId, createdAt: now }) }, { status: 201 });
    }
    case "helper-edit": {
      const helper = await getDoc(auth.familyId, "helper", body.helperId);
      if (!helper) return Response.json({ error: "unknown-helper" }, { status: 404 });
      const { action: _a, helperId: _h, ...fields } = body;
      void _a;
      void _h;
      return Response.json({ helper: await putDoc(auth.familyId, "helper", { ...helper, ...fields }) });
    }
    case "helper-remove": {
      const helper = await getDoc(auth.familyId, "helper", body.helperId);
      if (!helper) return Response.json({ error: "unknown-helper" }, { status: 404 });
      await deleteDoc(auth.familyId, "helper", helper.id);
      return Response.json({ removed: helper.id });
    }
    case "duty-set":
    case "duty-clear": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const id = `${body.forMemberId}:${body.kind}`;
      if (body.action === "duty-clear") {
        await deleteDoc(auth.familyId, "duty", id);
        return Response.json({ cleared: id });
      }
      const who = person(body.memberId);
      if (!who || who.access === "child") return Response.json({ error: "unknown-member" }, { status: 404 });
      return Response.json({ duty: await putDoc(auth.familyId, "duty", { id, forMemberId: body.forMemberId, kind: body.kind, memberId: who.id, updatedAt: now }) });
    }
    case "take-week": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const rota = await getDoc(auth.familyId, "rota", body.forMemberId);
      const order = [auth.memberId, ...(rota?.order ?? []).filter((id) => id !== auth.memberId)];
      return Response.json({ rota: await putDoc(auth.familyId, "rota", { id: body.forMemberId, forMemberId: body.forMemberId, order, startWeek: mondayOf(new Date()), updatedAt: now }) });
    }
    case "leave-rota": {
      const rota = await getDoc(auth.familyId, "rota", body.forMemberId);
      if (!rota) return Response.json({ error: "unknown-rota" }, { status: 404 });
      const order = rota.order.filter((id) => id !== auth.memberId);
      if (order.length === 0) {
        await deleteDoc(auth.familyId, "rota", rota.id);
        return Response.json({ rota: null });
      }
      return Response.json({ rota: await putDoc(auth.familyId, "rota", { ...rota, order, updatedAt: now }) });
    }
  }
}
