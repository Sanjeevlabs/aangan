"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { KIND_LOOK, KindBadge, daysUntil } from "@/components/together-art";
import { ActionMenu, Avatar, Button, EmptyLine, Icon, MuseMark, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Project, QuizItem } from "@/lib/kinds";
import { canChange } from "@/lib/permissions";
import { callName, memberPhoto } from "@/lib/people";
import { template, type TogetherTemplate } from "@/lib/together-templates";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { viewer, members } = useViewer();
  const { data, reload } = useJson<{ templates: TogetherTemplate[]; projects: Project[] }>("/api/together");
  const [text, setText] = useState("");
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const p = data?.projects.find((x) => x.id === id);

  if (!data) return <div className="skeleton mt-16 h-[420px] rounded-card" aria-busy="true" />;
  if (!p) {
    return (
      <div>
        <RoomHeader title="Together" />
        <EmptyLine>This isn&rsquo;t one of your family&rsquo;s projects anymore.</EmptyLine>
      </div>
    );
  }
  const t = p.templateId ? template(p.templateId) : undefined;
  const k = KIND_LOOK[p.kind];
  const act = async (body: Record<string, unknown>) => {
    await postJson("/api/together", { projectId: p.id, ...body });
    await reload();
  };
  const days = daysUntil(p.dueAt);
  const visitor = members.find((m) => m.id === p.visitorId);
  const done = p.tasks.filter((x) => x.done).length;
  const people = members.filter((m) => m.access !== "child" || m.id === viewer.id);
  const child = viewer.access === "child";

  return (
    <div>
      <RoomHeader
        title=""
        action={
          <ActionMenu
            label="Project options"
            actions={[
              { label: p.status === "done" ? "Not done yet" : "Mark as done", onSelect: () => act({ action: "finish", done: p.status !== "done" }) },
              ...(canChange(viewer, p.createdBy) ? [{ label: "Delete", danger: true, confirm: "Delete this project and its list?", onSelect: async () => { await postJson("/api/together", { action: "delete", projectId: p.id }); router.replace("/together"); } }] : []),
            ]}
          />
        }
      />
      <div className="flex items-center gap-3">
        <KindBadge kind={p.kind} />
        <div className="min-w-0">
          <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: k.ink }}>
            {k.label}
            {p.status === "done" ? " · done" : ""}
          </p>
          <h1 className="m-0 text-[27px] leading-tight">{p.title}</h1>
        </div>
      </div>

      {p.kind === "visit" && days !== null && (
        <div className="mt-4 rounded-hero p-5" style={{ background: k.bg }}>
          <p className="m-0 text-[56px] font-bold leading-none" style={{ color: k.ink }}>
            {days > 0 ? days : days === 0 ? "Today" : "✓"}
          </p>
          <p className="m-0 mt-1 text-[16px] font-medium">{days > 0 ? `day${days > 1 ? "s" : ""} till ${visitor?.id === viewer.id ? "you're" : `${callName(visitor)} is`} home` : days === 0 ? `${callName(visitor)} arrives today` : "They came home"}</p>
          <p className="m-0 mt-1 text-[13px] text-ink-soft">Both homes see this countdown on their courtyard.</p>
        </div>
      )}
      {p.kind !== "visit" && p.dueAt && <p className="m-0 mt-3 text-[14px] text-ink-soft">{days !== null && days >= 0 ? `${days === 0 ? "Today" : `In ${days} day${days > 1 ? "s" : ""}`} · ` : ""}{new Date(p.dueAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</p>}

      <SectionTitle>
        To do <span className="text-[15px] font-medium text-ink-faint">· {done}/{p.tasks.length}</span>
      </SectionTitle>
      <ul className="m-0 list-none divide-y divide-[var(--line)] rounded-card bg-surface p-0 px-3">
        {p.tasks.map((task) => {
          const who = members.find((m) => m.id === task.assignee);
          return (
            <li key={task.id} className="py-2">
              <div className="flex items-center gap-2.5">
                <button type="button" aria-pressed={task.done} aria-label={`${task.done ? "Not done" : "Done"}: ${task.text}`} onClick={() => act({ action: "task-toggle", taskId: task.id })} className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", task.done ? "border-black bg-black text-white" : "border-black/25")}>
                  {task.done && <Icon name="check" size={14} strokeWidth={3} />}
                </button>
                {editing === task.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 140))}
                    onBlur={async () => { if (draft.trim() && draft !== task.text) await act({ action: "task-edit", taskId: task.id, text: draft.trim() }); setEditing(null); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="h-10 min-w-0 flex-1 rounded-[12px] bg-white px-3 text-[15px] outline-none"
                    aria-label="Task"
                  />
                ) : (
                  <span className={cn("min-w-0 flex-1 text-[15px]", task.done && "text-ink-faint line-through decoration-black/20")}>{task.text}</span>
                )}
                <button type="button" onClick={() => setAssignFor(assignFor === task.id ? null : task.id)} aria-label={who ? `Assigned to ${callName(who)}. Change` : "Assign"} className="press shrink-0">
                  {who ? <Avatar src={memberPhoto(who)} name={callName(who)} size={30} /> : <span className="grid h-[30px] w-[30px] place-items-center rounded-full border border-dashed border-black/25 text-ink-faint"><Icon name="plus" size={14} /></span>}
                </button>
                <ActionMenu
                  label="Task options"
                  actions={[
                    { label: "Edit", onSelect: () => { setEditing(task.id); setDraft(task.text); } },
                    { label: "Delete", danger: true, confirm: "Delete this task?", onSelect: () => act({ action: "task-delete", taskId: task.id }) },
                  ]}
                />
              </div>
              {assignFor === task.id && (
                <div className="no-scrollbar -mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1">
                  {people.map((m) => (
                    <button key={m.id} type="button" aria-pressed={task.assignee === m.id} onClick={async () => { await act({ action: "task-assign", taskId: task.id, assignee: task.assignee === m.id ? null : m.id }); setAssignFor(null); }} className={cn("press flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3 text-[14px] font-medium", task.assignee === m.id ? "bg-black text-white" : "bg-white")}>
                      <Avatar src={memberPhoto(m)} name={callName(m)} size={30} />
                      {m.id === viewer.id ? "Me" : callName(m)}
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {p.tasks.length === 0 && <li className="py-4 text-center text-[14px] text-ink-soft">Nothing on the list yet.</li>}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await act({ action: "task-add", text: text.trim(), assignee: null });
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, 140))} placeholder="Add to the list" className="h-[48px] min-w-0 flex-1 rounded-full bg-surface px-5 text-[15px] outline-none focus:ring-2 focus:ring-marigold" aria-label="New task" />
        <Button type="submit" className="h-[48px] px-5" disabled={!text.trim()}>
          Add
        </Button>
      </form>

      {t?.muse === "quiz" && (
        <section aria-label="Quiz">
          <SectionTitle>The quiz</SectionTitle>
          {p.quiz.length === 0 ? (
            <Button
              className="w-full"
              disabled={busy || child}
              onClick={async () => {
                setBusy(true);
                await act({ action: "quiz" });
                setBusy(false);
              }}
            >
              {busy ? "Muse is writing…" : "Write the questions"}
            </Button>
          ) : (
            <Quiz items={p.quiz} />
          )}
          <MuseMark className="mt-2">from your family&rsquo;s own recipes, people and pets; nothing made up</MuseMark>
        </section>
      )}

      {t?.sitReason && (
        <Link href={`/gather?reason=${t.sitReason}`} className="press mt-8 flex h-[52px] items-center justify-center gap-2 rounded-full bg-surface text-[16px] font-semibold text-ink no-underline">
          <Icon name="door" size={18} />
          Book it as a Sit together
        </Link>
      )}
      {t?.muse === "cookbook" && (
        <Link href="/kitchen" className="press mt-3 flex h-[52px] items-center justify-center gap-2 rounded-full bg-surface text-[16px] font-semibold text-ink no-underline">
          <Icon name="pot" size={18} />
          Open the Kitchen
        </Link>
      )}
      {t && (
        <details className="mt-6 rounded-card bg-surface px-4 py-3">
          <summary className="cursor-pointer text-[14px] font-semibold text-ink-soft">How it works</summary>
          <ol className="m-0 mt-2 list-decimal space-y-1 pl-5 text-[14px]">
            {t.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/** One question at a time; tap to reveal. Played out loud on a call. */
function Quiz({ items }: { items: QuizItem[] }) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const q = items[i];
  return (
    <div className="rounded-card bg-[#e7eefc] p-4">
      <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#2f4f8a]">
        Question {i + 1} of {items.length}
        {q.from ? ` · from ${q.from}` : ""}
      </p>
      <p className="m-0 mt-1.5 text-[19px] font-semibold leading-snug">{q.q}</p>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
        {q.options.map((o, n) => (
          <li key={n} className={cn("rounded-[14px] px-3.5 py-2.5 text-[15px]", shown && n === q.answer ? "bg-[#2f4f8a] font-semibold text-white" : "bg-white")}>
            {o}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1 !bg-white" onClick={() => setShown((v) => !v)}>
          {shown ? "Hide answer" : "Show answer"}
        </Button>
        <Button className="flex-1" disabled={i >= items.length - 1} onClick={() => { setI(i + 1); setShown(false); }}>
          Next
        </Button>
      </div>
    </div>
  );
}
