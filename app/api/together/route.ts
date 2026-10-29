import { z } from "zod";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbGetMember, dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import type { Project } from "@/lib/kinds";
import { canChange } from "@/lib/permissions";
import { TEMPLATES, familyQuiz, template } from "@/lib/together";

// Together: start a template as a family project; everyone edits the list.
// GET  → templates + projects
// POST → start · blank · edit · delete · task-add · task-edit · task-toggle ·
//        task-assign · task-delete · quiz (Muse writes it from family data) · finish

const id = z.string().min(1).max(80);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), templateId: id, dueAt: z.string().datetime().nullable().default(null), visitorId: id.nullable().default(null), hostIds: z.array(id).max(12).default([]) }),
  z.object({ action: z.literal("blank"), title: z.string().trim().min(2).max(80), dueAt: z.string().datetime().nullable().default(null) }),
  z.object({ action: z.literal("edit"), projectId: id, title: z.string().trim().min(2).max(80), dueAt: z.string().datetime().nullable() }),
  z.object({ action: z.literal("delete"), projectId: id }),
  z.object({ action: z.literal("finish"), projectId: id, done: z.boolean().default(true) }),
  z.object({ action: z.literal("task-add"), projectId: id, text: z.string().trim().min(1).max(140), assignee: id.nullable().default(null) }),
  z.object({ action: z.literal("task-edit"), projectId: id, taskId: id, text: z.string().trim().min(1).max(140) }),
  z.object({ action: z.literal("task-toggle"), projectId: id, taskId: id }),
  z.object({ action: z.literal("task-assign"), projectId: id, taskId: id, assignee: id.nullable() }),
  z.object({ action: z.literal("task-delete"), projectId: id, taskId: id }),
  z.object({ action: z.literal("quiz"), projectId: id }),
]);

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  return Response.json({ templates: TEMPLATES, projects: await listDocs(auth.familyId, "project") });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/together")) return Response.json({ error: "rate-limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-together" }, { status: 400 });
  const body = parsed.data;
  const now = new Date().toISOString();
  const members = await dbListMembers(auth.familyId);
  const known = (x: string | null) => x === null || members.some((m) => m.id === x);

  if (body.action === "start" || body.action === "blank") {
    const t = body.action === "start" ? template(body.templateId) : undefined;
    if (body.action === "start" && !t) return Response.json({ error: "unknown-template" }, { status: 404 });
    if (body.action === "start" && (!known(body.visitorId) || !body.hostIds.every((h) => known(h)))) return Response.json({ error: "unknown-member" }, { status: 400 });
    const project = await putDoc(auth.familyId, "project", {
      id: newId("together"),
      templateId: t?.id ?? null,
      title: t?.title ?? (body.action === "blank" ? body.title : "Together"),
      kind: t?.kind ?? "make",
      createdBy: auth.memberId,
      dueAt: body.dueAt,
      visitorId: body.action === "start" ? body.visitorId : null,
      hostIds: body.action === "start" ? body.hostIds : [],
      tasks: (t?.tasks ?? []).map((text) => ({ id: newId("t"), text, assignee: null, done: false })),
      quiz: [],
      status: "active",
      createdAt: now,
    });
    return Response.json({ project }, { status: 201 });
  }

  const project = await getDoc(auth.familyId, "project", body.projectId);
  if (!project) return Response.json({ error: "unknown-project" }, { status: 404 });
  const me = await dbGetMember(auth.memberId);
  const save = (p: Partial<Project>) => putDoc(auth.familyId, "project", { ...project, ...p });
  const task = "taskId" in body ? project.tasks.find((t) => t.id === body.taskId) : undefined;
  if ("taskId" in body && !task) return Response.json({ error: "unknown-task" }, { status: 404 });
  const tasks = (fn: (t: Project["tasks"][number]) => Project["tasks"][number] | null) => project.tasks.map(fn).filter((t): t is Project["tasks"][number] => t !== null);

  switch (body.action) {
    case "edit":
      return Response.json({ project: await save({ title: body.title, dueAt: body.dueAt }) });
    case "finish":
      return Response.json({ project: await save({ status: body.done ? "done" : "active" }) });
    case "delete":
      if (!canChange(me, project.createdBy)) return Response.json({ error: "not-yours" }, { status: 403 });
      await deleteDoc(auth.familyId, "project", project.id);
      return Response.json({ deleted: project.id });
    case "task-add":
      if (!known(body.assignee)) return Response.json({ error: "unknown-member" }, { status: 400 });
      if (project.tasks.length >= 40) return Response.json({ error: "too-many-tasks" }, { status: 409 });
      return Response.json({ project: await save({ tasks: [...project.tasks, { id: newId("t"), text: body.text, assignee: body.assignee, done: false }] }) }, { status: 201 });
    case "task-edit":
      return Response.json({ project: await save({ tasks: tasks((t) => (t.id === body.taskId ? { ...t, text: body.text } : t)) }) });
    case "task-toggle":
      return Response.json({ project: await save({ tasks: tasks((t) => (t.id === body.taskId ? { ...t, done: !t.done } : t)) }) });
    case "task-assign":
      if (!known(body.assignee)) return Response.json({ error: "unknown-member" }, { status: 400 });
      return Response.json({ project: await save({ tasks: tasks((t) => (t.id === body.taskId ? { ...t, assignee: body.assignee } : t)) }) });
    case "task-delete":
      return Response.json({ project: await save({ tasks: tasks((t) => (t.id === body.taskId ? null : t)) }) });
    case "quiz": {
      const [recipes, pets] = await Promise.all([listDocs(auth.familyId, "recipe"), listDocs(auth.familyId, "pet")]);
      const { items, source } = await familyQuiz(auth.familyId, {
        recipes: recipes.map((r) => ({ title: r.title, cookId: r.cookId, memory: r.memory })),
        members: members.map((m) => ({ id: m.id, displayName: m.displayName, tz: m.tz, birthday: m.birthday, role: m.role })),
        pets: pets.map((p) => ({ name: p.name, species: p.species, livesWith: p.livesWith })),
      });
      return Response.json({ project: await save({ quiz: items }), source });
    }
  }
}
