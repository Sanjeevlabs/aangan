import { beforeEach, describe, expect, it } from "vitest";
import { GET as storiesGet, POST as storiesPost } from "@/app/api/stories/route";
import { GET as togetherGet, POST as togetherPost } from "@/app/api/together/route";
import type { Project, Question, Story } from "@/lib/kinds";
import { mockStoryLabel } from "@/lib/stories";
import { TEMPLATES } from "@/lib/together-templates";
import { addCard, resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (url: string, member: string, body?: unknown) =>
  new Request(`http://test${url}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;

beforeEach(() => resetDemo());
let n = 0;
const dadiVoice = (transcript: string) => addCard({ id: `test-voice-${++n}`, familyId: "demo-family", type: "audio", caption: "", lang: "hi", takenAt: new Date().toISOString(), authorId: "dadi", transcript, transcriptLang: "hi" });

describe("stories", () => {
  it("seeds the kids' corner and labels themes without writing the story", async () => {
    const d = await json<{ stories: Story[]; requests: Question[] }>(storiesGet(req("/api/stories", "leo")));
    expect(d.stories.map((s) => s.tellerId)).toEqual(expect.arrayContaining(["dadi", "dada"]));
    expect(d.requests.some((q) => q.askedBy === "priya" && q.toMemberId === "dada")).toBe(true);
    expect(mockStoryLabel("Ek haathi roz nadi jaata tha.").theme).toBe("animals");
    expect(mockStoryLabel("सो जा, नींद आ जाएगी").theme).toBe("lullaby");
  });

  it("a child asks; the grandparent answers by voice; it becomes a story and the request closes", async () => {
    const asked = await json<{ question: Question }>(storiesPost(req("/api/stories", "aria", { action: "request", toMemberId: "dadi", about: "a clever monkey" })));
    expect(asked.question).toMatchObject({ topic: "story", askedBy: "aria", text: "Tell me a story about a clever monkey" });
    const voice = dadiVoice("एक चालाक बंदर था जो पेड़ पर रहता था।");
    const told = await json<{ story: Story }>(storiesPost(req("/api/stories", "dadi", { action: "tell", cardId: voice.id, questionId: asked.question.id })));
    expect(told.story).toMatchObject({ tellerId: "dadi", questionId: asked.question.id });
    const after = await json<{ requests: Question[] }>(storiesGet(req("/api/stories", "aria")));
    expect(after.requests.some((q) => q.id === asked.question.id)).toBe(false);
  });

  it("only the teller (or an admin) edits or removes a story; kids can't tell for someone else", async () => {
    const d = await json<{ stories: Story[] }>(storiesGet(req("/api/stories", "leo")));
    const s = d.stories.find((x) => x.tellerId === "dadi")!;
    expect((await storiesPost(req("/api/stories", "leo", { action: "edit", storyId: s.id, title: "Mine now", theme: "funny", ages: "all" }))).status).toBe(403);
    expect((await storiesPost(req("/api/stories", "dadi", { action: "edit", storyId: s.id, title: "हाथी", theme: "animals", ages: "5-8" }))).status).toBe(200);
    expect((await storiesPost(req("/api/stories", "aria", { action: "tell", cardId: dadiVoice("एक कहानी").id }))).status).toBe(403);
    expect((await storiesPost(req("/api/stories", "arjun", { action: "delete", storyId: s.id }))).status).toBe(200);
    expect((await storiesPost(req("/api/stories", "leo", { action: "request", toMemberId: "leo", about: "me" }))).status).toBe(404);
  });
});

describe("visits & holidays", () => {
  it("keeps only a visit home and a family holiday, both counting down", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(["holiday", "visit"]);
    expect(TEMPLATES.every((t) => t.kind === "visit")).toBe(true);
  });

  it("start → assign → tick → edit → delete a task → people → finish", async () => {
    const dueAt = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const started = await json<{ project: Project }>(togetherPost(req("/api/together", "priya", { action: "start", templateId: "holiday", title: "Goa in December", dueAt, hostIds: ["priya", "arjun", "leo"] })));
    const p = started.project;
    expect(p).toMatchObject({ kind: "visit", templateId: "holiday", title: "Goa in December", hostIds: ["priya", "arjun", "leo"] });
    expect(p.tasks.length).toBe(5);
    const t = p.tasks[0];
    let r = await json<{ project: Project }>(togetherPost(req("/api/together", "dadi", { action: "task-assign", projectId: p.id, taskId: t.id, assignee: "dadi" })));
    expect(r.project.tasks[0].assignee).toBe("dadi");
    r = await json(togetherPost(req("/api/together", "dadi", { action: "task-toggle", projectId: p.id, taskId: t.id })));
    expect(r.project.tasks[0].done).toBe(true);
    r = await json(togetherPost(req("/api/together", "leo", { action: "task-add", projectId: p.id, text: "Pack the cricket bat" })));
    expect(r.project.tasks).toHaveLength(6);
    r = await json(togetherPost(req("/api/together", "leo", { action: "task-edit", projectId: p.id, taskId: r.project.tasks[5].id, text: "Pack the bat and ball" })));
    expect(r.project.tasks[5].text).toBe("Pack the bat and ball");
    r = await json(togetherPost(req("/api/together", "leo", { action: "task-delete", projectId: p.id, taskId: r.project.tasks[5].id })));
    expect(r.project.tasks).toHaveLength(5);
    r = await json(togetherPost(req("/api/together", "priya", { action: "people", projectId: p.id, visitorId: null, hostIds: ["priya", "dadi"] })));
    expect(r.project.hostIds).toEqual(["priya", "dadi"]);
    expect((await togetherPost(req("/api/together", "dadi", { action: "task-assign", projectId: p.id, taskId: t.id, assignee: "stranger" }))).status).toBe(400);
    r = await json(togetherPost(req("/api/together", "priya", { action: "finish", projectId: p.id })));
    expect(r.project.status).toBe("done");
    expect((await togetherPost(req("/api/together", "leo", { action: "delete", projectId: p.id }))).status).toBe(403);
    expect((await togetherPost(req("/api/together", "priya", { action: "delete", projectId: p.id }))).status).toBe(200);
  });

  it("retired templates are refused, children can't start a plan, and old projects stay hidden", async () => {
    expect((await togetherPost(req("/api/together", "arjun", { action: "start", templateId: "quiz-night" }))).status).toBe(400);
    expect((await togetherPost(req("/api/together", "aria", { action: "start", templateId: "visit", visitorId: "aria" }))).status).toBe(403);
    const d = await json<{ projects: Project[] }>(togetherGet(req("/api/together", "arjun")));
    expect(d.projects.every((p) => p.kind === "visit")).toBe(true);
  });

  it("a visit counts down for both homes", async () => {
    const d = await json<{ projects: Project[] }>(togetherGet(req("/api/together", "dadi")));
    const v = d.projects.find((p) => p.kind === "visit")!;
    expect(v).toMatchObject({ visitorId: "arjun", hostIds: ["dadi", "dada"] });
    expect(Date.parse(v.dueAt!)).toBeGreaterThan(Date.now());
  });
});
