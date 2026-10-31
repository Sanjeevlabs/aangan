"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlanBadge, countdownWords, daysUntil } from "@/components/together-art";
import { Avatar, Button, EmptyLine, Icon, RoomHeader, SectionTitle } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import type { Project } from "@/lib/kinds";
import { callName, memberPhoto } from "@/lib/people";
import type { Member } from "@/lib/schemas";
import type { TogetherTemplate } from "@/lib/together-templates";
import { postJson, useJson } from "@/lib/use-json";
import { cn } from "@/lib/utils";

// Visits & holidays: plan a visit home or a family holiday — dates, who's
// going, a shared list, and a countdown both homes see.

export default function TogetherPage() {
  const { viewer } = useViewer();
  const { data, failed, reload } = useJson<{ templates: TogetherTemplate[]; projects: Project[] }>("/api/together");
  const [open, setOpen] = useState<TogetherTemplate | null>(null);
  const projects = data?.projects ?? [];
  const active = projects.filter((p) => p.status === "active").sort((a, b) => (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"));
  const done = projects.filter((p) => p.status === "done");
  const child = viewer.access === "child";

  return (
    <div>
      <RoomHeader title="Visits & holidays" subtitle="Plan time together. Both homes see the countdown." />

      {failed && (
        <div className="text-center">
          <EmptyLine>Couldn&rsquo;t load your plans.</EmptyLine>
          <Button variant="secondary" className="mx-auto" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      )}
      {data === null && !failed && <div className="skeleton h-[180px] rounded-card" aria-busy="true" aria-label="Loading plans" />}

      {data && (
        <>
          {active.length > 0 ? (
            <ul className="no-scrollbar -mx-5 m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto px-5 p-0" aria-label="Coming up">
              {active.map((p) => (
                <li key={p.id} className="w-[78%] max-w-[320px] shrink-0 snap-start">
                  <PlanCard project={p} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine>Nothing planned yet. Start with a visit home.</EmptyLine>
          )}

          {!child && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {data.templates.map((t) => (
                <button key={t.id} type="button" onClick={() => setOpen(t)} className="press frost flex items-center gap-3 rounded-card p-3 text-left">
                  <PlanBadge holiday={t.id === "holiday"} size={40} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight">{t.title}</span>
                    <span className="block text-[12.5px] text-ink-soft">Plan it</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {done.length > 0 && (
            <section aria-label="Done together">
              <SectionTitle>Been together</SectionTitle>
              <ul className="no-scrollbar -mx-5 m-0 flex list-none gap-2 overflow-x-auto px-5 p-0">
                {done.map((p) => (
                  <li key={p.id} className="shrink-0">
                    <Link href={`/together/${p.id}`} className="press flex h-11 items-center gap-2 rounded-full bg-surface pl-1.5 pr-4 text-[14px] font-medium text-ink no-underline">
                      <PlanBadge holiday={p.templateId === "holiday"} size={32} />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {open && <PlanSheet t={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PlanCard({ project }: { project: Project }) {
  const { members } = useViewer();
  const days = daysUntil(project.dueAt);
  const done = project.tasks.filter((t) => t.done).length;
  const people = [project.visitorId, ...project.hostIds].map((id) => members.find((m) => m.id === id)).filter((m): m is Member => Boolean(m));
  return (
    <Link href={`/together/${project.id}`} className="press flex h-full flex-col rounded-card bg-surface p-4 text-ink no-underline">
      <div className="flex items-start justify-between gap-2">
        <span className="tnum text-[44px] font-bold leading-none">{days !== null && days > 0 ? days : days === 0 ? "Today" : "–"}</span>
        <PlanBadge holiday={project.templateId === "holiday"} size={36} />
      </div>
      <span className="mt-1 block text-[13px] text-ink-soft">{days !== null && days > 0 ? `day${days > 1 ? "s" : ""} to go` : days === 0 ? "it's today" : "no date yet"}</span>
      <span className="mt-3 block truncate text-[16px] font-semibold">{project.title}</span>
      <span className="mt-2 flex items-center justify-between">
        <span className="flex -space-x-2">
          {people.slice(0, 4).map((m) => (
            <Avatar key={m.id} src={memberPhoto(m)} name={callName(m)} size={28} ring />
          ))}
        </span>
        <span className="tnum text-[13px] text-ink-soft">
          {done}/{project.tasks.length}
        </span>
      </span>
    </Link>
  );
}

/** Start a visit or a holiday: dates and who's going. */
function PlanSheet({ t, onClose }: { t: TogetherTemplate; onClose: () => void }) {
  const router = useRouter();
  const { viewer, members } = useViewer();
  const holiday = t.id === "holiday";
  const elders = members.filter((m) => m.role === "elder").map((m) => m.id);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [visitor, setVisitor] = useState(viewer.id);
  const [going, setGoing] = useState<string[]>(holiday ? [viewer.id] : elders.filter((e) => e !== viewer.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const toggle = (id: string) => setGoing((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  const chips = (selected: (id: string) => boolean, onTap: (id: string) => void, label: string) => (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label={label}>
      {members.map((m) => (
        <button key={m.id} type="button" aria-pressed={selected(m.id)} onClick={() => onTap(m.id)} className={cn("press flex h-11 shrink-0 items-center gap-2 rounded-full pl-1 pr-4 text-[15px] font-medium", selected(m.id) ? "bg-ink text-white" : "bg-surface")}>
          <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
          {m.id === viewer.id ? "Me" : callName(m)}
        </button>
      ))}
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t.title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="frost relative max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] px-5 pt-4" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
        <div className="flex items-center gap-3">
          <PlanBadge holiday={holiday} />
          <p className="m-0 min-w-0 flex-1 text-[21px] font-semibold leading-tight">{t.title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="press grid h-10 w-10 place-items-center rounded-full text-ink-soft">
            <Icon name="close" />
          </button>
        </div>
        <p className="m-0 mt-2 text-[15px] text-ink-soft">{t.blurb}</p>
        {holiday && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Where to?</span>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Goa in December" className="h-[48px] w-full rounded-full bg-surface px-5 text-[16px] outline-none" />
          </label>
        )}
        <p className="m-0 mb-1.5 mt-4 text-[13px] font-medium text-ink-soft">{t.whoLabel}</p>
        {holiday
          ? chips((id) => going.includes(id), toggle, t.whoLabel)
          : chips((id) => id === visitor, (id) => { setVisitor(id); setGoing((g) => g.filter((x) => x !== id)); }, t.whoLabel)}
        {!holiday && (
          <>
            <p className="m-0 mb-1.5 mt-4 text-[13px] font-medium text-ink-soft">Staying with</p>
            {chips((id) => going.includes(id), (id) => id !== visitor && toggle(id), "Staying with")}
          </>
        )}
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{holiday ? "Leaving on" : "Arriving on"}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-[48px] w-full rounded-full bg-surface px-5 text-[16px]" />
        </label>
        {error && (
          <p className="m-0 mt-3 text-[14px] text-[#b42318]" role="alert">
            Couldn&rsquo;t save it. Try again.
          </p>
        )}
        <Button
          className="mt-5 w-full"
          disabled={busy || !date || (holiday && going.length === 0)}
          onClick={async () => {
            setBusy(true);
            setError(false);
            const out = await postJson<{ project: Project }>("/api/together", {
              action: "start",
              templateId: t.id,
              ...(holiday && title.trim().length >= 2 ? { title: title.trim() } : {}),
              dueAt: new Date(`${date}T12:00:00`).toISOString(),
              visitorId: holiday ? null : visitor,
              hostIds: going,
            });
            setBusy(false);
            if (out) router.push(`/together/${out.project.id}`);
            else setError(true);
          }}
        >
          {busy ? "Saving…" : countdownWords(daysUntil(date ? new Date(`${date}T12:00:00`).toISOString() : null)) ? `Start the countdown · ${countdownWords(daysUntil(new Date(`${date}T12:00:00`).toISOString()))}` : "Start the countdown"}
        </Button>
      </div>
    </div>
  );
}
