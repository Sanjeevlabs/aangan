"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KIND_LOOK, KindBadge, daysUntil } from "@/components/together-art";
import { Avatar, Button, EmptyLine, Icon, MuseMark, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { PROJECT_KINDS } from "@/lib/kind-values";
import type { Project } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import type { TogetherTemplate } from "@/lib/together-templates";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";

// Together: ready-made things to do as a family across homes. Pick one, and
// it becomes a project with a task list everyone can add to and tick off.

export default function TogetherPage() {
  const { viewer, members } = useViewer();
  const router = useRouter();
  const { data } = useJson<{ templates: TogetherTemplate[]; projects: Project[] }>("/api/together");
  const [kind, setKind] = useState<Project["kind"] | "all">("all");
  const [open, setOpen] = useState<TogetherTemplate | null>(null);
  const [blank, setBlank] = useState("");
  const active = (data?.projects ?? []).filter((p) => p.status === "active");
  const done = (data?.projects ?? []).filter((p) => p.status === "done");
  const templates = (data?.templates ?? []).filter((t) => kind === "all" || t.kind === kind);
  const child = viewer.access === "child";

  return (
    <div>
      <RoomHeader title="Together" subtitle="Things to do as a family, wherever everyone is" />

      {active.length > 0 && (
        <section aria-label="What the family is doing">
          <h2 className="m-0 mb-3 text-[20px]">Happening now</h2>
          <ul className="m-0 list-none space-y-2 p-0">
            {active.map((p) => (
              <li key={p.id}>
                <ProjectRow project={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <SectionTitle>Ideas</SectionTitle>
      <div className="no-scrollbar -mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5" role="radiogroup" aria-label="Kind">
        {(["all", ...PROJECT_KINDS] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("press h-9 shrink-0 rounded-full px-3.5 text-[14px] font-medium", kind === k ? "bg-black text-white" : "bg-surface")}>
            {k === "all" ? "All" : KIND_LOOK[k].label}
          </button>
        ))}
      </div>
      {data === null && <div className="skeleton h-[300px] rounded-card" aria-busy="true" aria-label="Loading ideas" />}
      <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
        {templates.map((t) => {
          const k = KIND_LOOK[t.kind];
          return (
            <li key={t.id}>
              <button type="button" onClick={() => setOpen(t)} className="press flex h-full w-full flex-col rounded-card p-3.5 text-left" style={{ background: k.bg }}>
                <KindBadge kind={t.kind} />
                <span className="mt-3 block text-[15.5px] font-semibold leading-tight">{t.title}</span>
                <span className="mt-1 block text-[12.5px]" style={{ color: k.ink }}>
                  {k.label}
                  {t.minutes ? ` · ${t.minutes} min` : ""} · {t.ages}
                </span>
                {t.muse && <MuseMark className="mt-1.5">Muse helps</MuseMark>}
              </button>
            </li>
          );
        })}
      </ul>

      {!child && (
        <div className="mt-4 flex gap-2">
          <input value={blank} onChange={(e) => setBlank(e.target.value.slice(0, 80))} placeholder="Or start your own: Paint Dadi's room…" className="h-[52px] min-w-0 flex-1 rounded-full bg-surface px-5 text-[15px] outline-none focus:ring-2 focus:ring-marigold" aria-label="Your own project" />
          <Button
            className="h-[52px] px-5"
            disabled={blank.trim().length < 2}
            onClick={async () => {
              const out = await postJson<{ project: Project }>("/api/together", { action: "blank", title: blank.trim() });
              if (out) router.push(`/together/${out.project.id}`);
            }}
          >
            Start
          </Button>
        </div>
      )}

      {done.length > 0 && (
        <section aria-label="Done together">
          <SectionTitle>Done together</SectionTitle>
          <ul className="m-0 list-none space-y-2 p-0">
            {done.map((p) => (
              <li key={p.id}>
                <ProjectRow project={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {data && data.templates.length === 0 && <EmptyLine>No ideas loaded.</EmptyLine>}
      {open && <TemplateSheet t={open} members={members} viewerId={viewer.id} canStart={!child} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const { members, viewer } = useViewer();
  const done = project.tasks.filter((t) => t.done).length;
  const days = daysUntil(project.dueAt);
  const people = Array.from(new Set(project.tasks.map((t) => t.assignee).filter((x): x is string => Boolean(x)))).map((id) => members.find((m) => m.id === id)).filter(Boolean);
  const mine = project.tasks.filter((t) => t.assignee === viewer.id && !t.done).length;
  return (
    <Link href={`/together/${project.id}`} className="press flex items-center gap-3 rounded-card bg-surface p-3.5 text-ink no-underline">
      <KindBadge kind={project.kind} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{project.title}</span>
        <span className="block truncate text-[13px] text-ink-soft">
          {done}/{project.tasks.length} done
          {days !== null && days >= 0 ? ` · ${days === 0 ? "today" : `in ${days} day${days > 1 ? "s" : ""}`}` : ""}
          {mine ? ` · ${mine} for you` : ""}
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-black/10">
          <span className="block h-full rounded-full" style={{ width: `${project.tasks.length ? (100 * done) / project.tasks.length : 0}%`, background: KIND_LOOK[project.kind].accent }} />
        </span>
      </span>
      <span className="flex shrink-0 -space-x-2">
        {people.slice(0, 3).map((m) => m && <Avatar key={m.id} src={memberPhoto(m)} name={callName(m)} size={28} ring />)}
      </span>
    </Link>
  );
}

function TemplateSheet({ t, members, viewerId, canStart, onClose }: { t: TogetherTemplate; members: { id: string; displayName: string; role: string }[]; viewerId: string; canStart: boolean; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [visitor, setVisitor] = useState(viewerId);
  const [busy, setBusy] = useState(false);
  const k = KIND_LOOK[t.kind];
  const elders = members.filter((m) => m.role === "elder").map((m) => m.id);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t.title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] bg-white px-5 pt-4 shadow-frost" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
        <div className="flex items-start gap-3">
          <KindBadge kind={t.kind} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: k.ink }}>
              {k.label}
              {t.minutes ? ` · ${t.minutes} min` : ""} · {t.ages}
            </p>
            <p className="m-0 text-[21px] font-semibold leading-tight">{t.title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft">
            <Icon name="close" />
          </button>
        </div>
        <p className="m-0 mt-3 text-[15px]">{t.blurb}</p>
        <p className="m-0 mt-2 text-[13px] text-ink-soft">Who: {t.people}</p>
        {t.needs.length > 0 && <p className="m-0 mt-1 text-[13px] text-ink-soft">You&rsquo;ll need: {t.needs.join(", ")}</p>}
        <ol className="m-0 mt-4 list-none space-y-2 p-0">
          {t.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[15px]">
              <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: k.ink }}>
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        {t.muse === "quiz" && <MuseMark className="mt-3">Muse writes the questions from your family&rsquo;s own recipes, people and pets</MuseMark>}
        {canStart && (
          <div className="mt-5 space-y-2 rounded-card bg-surface p-3">
            {t.kind === "visit" && (
              <label className="block">
                <span className="mb-1 block text-[13px] font-medium text-ink-soft">Who&rsquo;s coming home?</span>
                <select value={visitor} onChange={(e) => setVisitor(e.target.value)} className="h-11 w-full rounded-full bg-white px-4 text-[15px]">
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === viewerId ? "Me" : m.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-ink-soft">{t.kind === "visit" ? "Arriving on" : "When (optional)"}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-full bg-white px-4 text-[15px]" />
            </label>
            <Button
              className="w-full"
              disabled={busy || (t.kind === "visit" && !date)}
              onClick={async () => {
                setBusy(true);
                const out = await postJson<{ project: Project }>("/api/together", {
                  action: "start",
                  templateId: t.id,
                  dueAt: date ? new Date(`${date}T12:00:00`).toISOString() : null,
                  visitorId: t.kind === "visit" ? visitor : null,
                  hostIds: t.kind === "visit" ? elders.filter((e) => e !== visitor) : [],
                });
                setBusy(false);
                if (out) router.push(`/together/${out.project.id}`);
              }}
            >
              {busy ? "Starting…" : "Start this together"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
