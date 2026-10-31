"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { SendSheet } from "@/components/send-sheet";
import { Avatar, Icon, RoomHeader, type IconName } from "@/components/ui/kit";
import { useViewer } from "@/components/viewer";
import { callName, memberPhoto } from "@/lib/people";
import { appsFor, countryForTz } from "@/lib/send-apps";
import { cn } from "@/lib/utils";

// Send something (SPEC §9), the first page in Care. Who it's for, the apps
// their home already uses (links only, by their country: data/send-apps.json),
// then Muse's three ideas from the family's connected partners.
// Opened from the window, a care task, an occasion, or Care in the rooms.

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function AppCategories({ tz, name }: { tz: string | null | undefined; name: string }) {
  const set = useMemo(() => appsFor(countryForTz(tz)), [tz]);
  return (
    <section aria-label="Their apps" className="mb-8">
      <h2 className="m-0 text-[20px]">In their apps</h2>
      <p className="m-0 mt-0.5 text-[14px] text-ink-soft">What people use in {set.name}, for {name}&rsquo;s home.</p>
      <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-2.5 p-0">
        {set.categories.map((c) => (
          <li key={c.id} className="rounded-card bg-card p-3 shadow-card" data-category={c.id}>
            <p className="m-0 mb-1.5 flex items-center gap-2 text-[14.5px] font-semibold">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-well" aria-hidden="true">
                <Icon name={c.icon as IconName} size={16} strokeWidth={1.8} />
              </span>
              {c.label}
            </p>
            <ul className="m-0 list-none p-0">
              {c.apps.map((a) => (
                <li key={a.url}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} (opens ${host(a.url)})`} className="press -mx-1 flex min-h-[44px] items-center gap-2 rounded-[12px] px-1 text-ink no-underline hover:bg-black/[.03]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-well text-[12px] font-bold text-ink-soft" aria-hidden="true">
                      {a.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium leading-tight">{a.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-faint">{host(a.url)}</span>
                    </span>
                    <Icon name="external" size={13} className="shrink-0 text-ink-faint" />
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3 text-[12.5px] text-ink-faint">Links open their own app or site. Pay there.</p>
    </section>
  );
}

function Send() {
  const params = useSearchParams();
  const router = useRouter();
  const { viewer, members } = useViewer();
  // Who you might send to: the grandparents first, then the other grown-ups.
  const people = useMemo(
    () => members.filter((m) => m.id !== viewer.id && m.role !== "child").sort((a, b) => Number(b.role === "elder") - Number(a.role === "elder")),
    [members, viewer.id],
  );
  const forMemberId = params.get("for") ?? people.find((m) => m.role === "elder")?.id ?? people[0]?.id ?? "";
  const person = members.find((m) => m.id === forMemberId);
  const title = params.get("title");
  const kind = params.get("kind") === "need" ? "need" : "occasion";
  const pick = (id: string) => {
    const q = new URLSearchParams(params.toString());
    q.set("for", id);
    router.replace(`/send?${q.toString()}`);
  };
  return (
    <div>
      <RoomHeader title="Send something" subtitle="Groceries, sweets, a gift: in their own apps, or Muse's ideas" />
      {people.length > 1 && (
        <div className="no-scrollbar -mx-5 mb-5 flex gap-1.5 overflow-x-auto px-5" role="radiogroup" aria-label="Send to">
          {people.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={m.id === forMemberId} onClick={() => pick(m.id)} className={cn("press flex h-11 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-3.5 text-[14px] font-medium", m.id === forMemberId ? "bg-ink text-white" : "bg-card shadow-card")}>
              <Avatar src={memberPhoto(m)} name={callName(m)} size={34} />
              {callName(m)}
            </button>
          ))}
        </div>
      )}
      {person && <AppCategories tz={person.tz} name={callName(person)} />}
      {forMemberId && <SendSheet key={forMemberId} inline forMemberId={forMemberId} context={title ? { kind, title } : undefined} open onClose={() => undefined} />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Send />
    </Suspense>
  );
}
