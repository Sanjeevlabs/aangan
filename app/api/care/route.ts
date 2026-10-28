import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbAddAgentRun, dbListCards, dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { needFromVoice, noteForParent } from "@/lib/care";
import { HELPER_ROLES, NEED_KINDS, type Need } from "@/lib/kinds";
import type { Member } from "@/lib/schemas";

// Care circle: needs (open → claimed → done), the parent's Village (trusted
// local people), and whose week it is. Tasks only: no health advice anywhere.

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("need"), forMemberId: z.string().min(1), title: z.string().trim().min(3).max(120), kind: z.enum(NEED_KINDS).default("other"), when: z.string().trim().max(60).default("") }),
  z.object({ action: z.literal("need-from-voice"), cardId: z.string().min(1), forMemberId: z.string().min(1) }),
  z.object({ action: z.literal("claim"), needId: z.string().min(1) }),
  z.object({ action: z.literal("assign"), needId: z.string().min(1), helperId: z.string().min(1) }),
  z.object({ action: z.literal("done"), needId: z.string().min(1) }),
  z.object({ action: z.literal("reopen"), needId: z.string().min(1) }),
  z.object({
    action: z.literal("helper"),
    forMemberId: z.string().min(1),
    name: z.string().trim().min(1).max(60),
    role: z.enum(HELPER_ROLES).default("other"),
    phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/).default(""),
    note: z.string().trim().max(160).default(""),
  }),
  z.object({ action: z.literal("helper-remove"), helperId: z.string().min(1) }),
  z.object({ action: z.literal("take-week"), forMemberId: z.string().min(1) }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const [needs, helpers, rotas] = await Promise.all([listDocs(auth.familyId, "need"), listDocs(auth.familyId, "helper"), listDocs(auth.familyId, "rota")]);
  return Response.json({ needs, helpers, rotas });
}

function mondayOf(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-care" }, { status: 400 });
  const body = parsed.data;
  const members = await dbListMembers(auth.familyId);
  const person = (id: string): Member | undefined => members.find((m) => m.id === id);
  const me = person(auth.memberId);
  const now = new Date().toISOString();

  const loadNeed = async (id: string): Promise<Need | Response> => (await getDoc(auth.familyId, "need", id)) ?? Response.json({ error: "unknown-need" }, { status: 404 });
  const reassure = async (need: Need, english: string) => {
    const parent = person(need.forMemberId);
    return parent ? noteForParent(auth.familyId, parent, english) : english;
  };

  switch (body.action) {
    case "need": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const need = await putDoc(auth.familyId, "need", { id: newId("need"), forMemberId: body.forMemberId, askedBy: auth.memberId, title: body.title, kind: body.kind, when: body.when, status: "open", createdAt: now });
      return Response.json({ need }, { status: 201 });
    }
    case "need-from-voice": {
      const parent = person(body.forMemberId);
      const card = (await dbListCards(auth.familyId)).find((c) => c.id === body.cardId);
      if (!parent || !card) return Response.json({ error: "unknown" }, { status: 404 });
      const draft = await needFromVoice(auth.familyId, parent.displayName, card.transcript || card.caption, card.transcriptLang || card.lang);
      const need = await putDoc(auth.familyId, "need", { id: newId("need"), forMemberId: parent.id, askedBy: auth.memberId, ...draft, status: "open", createdAt: now });
      await dbAddAgentRun({ goal: `Care: turned ${parent.displayName}'s voice into a task`, tools: ["muse-voice-transcribe", "muse-spark", "create_need"], familyId: auth.familyId });
      return Response.json({ need }, { status: 201 });
    }
    case "claim": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      const noteForParent = await reassure(need, `${me?.displayName ?? "Family"} is taking care of it.`);
      return Response.json({ need: await putDoc(auth.familyId, "need", { ...need, status: "claimed", claimedBy: auth.memberId, noteForParent }) });
    }
    case "assign": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      const helper = await getDoc(auth.familyId, "helper", body.helperId);
      if (!helper || helper.forMemberId !== need.forMemberId) return Response.json({ error: "unknown-helper" }, { status: 404 });
      const english = `${helper.name} will help${need.when ? ` (${need.when})` : ""}. ${me?.displayName ?? "Family"} arranged it.`;
      return Response.json({ need: await putDoc(auth.familyId, "need", { ...need, status: "claimed", claimedBy: need.claimedBy ?? auth.memberId, helperId: helper.id, noteForParent: await reassure(need, english) }) });
    }
    case "done": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      return Response.json({ need: await putDoc(auth.familyId, "need", { ...need, status: "done", claimedBy: need.claimedBy ?? auth.memberId, doneAt: now }) });
    }
    case "reopen": {
      const need = await loadNeed(body.needId);
      if (need instanceof Response) return need;
      return Response.json({ need: await putDoc(auth.familyId, "need", { ...need, status: "open", claimedBy: null, helperId: null, noteForParent: "", doneAt: null }) });
    }
    case "helper": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const { action: _a, ...rest } = body;
      void _a;
      const helper = await putDoc(auth.familyId, "helper", { id: newId("helper"), ...rest, addedBy: auth.memberId, createdAt: now });
      return Response.json({ helper }, { status: 201 });
    }
    case "helper-remove": {
      const helper = await getDoc(auth.familyId, "helper", body.helperId);
      if (!helper) return Response.json({ error: "unknown-helper" }, { status: 404 });
      await deleteDoc(auth.familyId, "helper", helper.id);
      return Response.json({ removed: helper.id });
    }
    case "take-week": {
      if (!person(body.forMemberId)) return Response.json({ error: "unknown-member" }, { status: 404 });
      const rota = await getDoc(auth.familyId, "rota", body.forMemberId);
      const order = [auth.memberId, ...(rota?.order ?? []).filter((id) => id !== auth.memberId)];
      return Response.json({ rota: await putDoc(auth.familyId, "rota", { id: body.forMemberId, forMemberId: body.forMemberId, order, startWeek: mondayOf(new Date()), updatedAt: now }) });
    }
  }
}
