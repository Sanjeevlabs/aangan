"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Icon } from "@/components/ui/kit";
import { useShell } from "@/components/shell";
import { useViewer } from "@/components/viewer";
import type { Knock, Sitting } from "@/lib/kinds";
import { roomUrl } from "@/lib/overlap";
import { callName, memberPhoto } from "@/lib/people";
import { postJson, useJson } from "@/lib/use-json";
import { placeFromTz, timeIn } from "@/lib/zones";

// Sitting together, inside Aangan: the family's faces and clocks along the
// top, the video room below. Only a knock or sitting of this family opens a
// room; its name is the random id, never a guessable family name.

export default function CallPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setChromeHidden } = useShell();
  const { viewer, members } = useViewer();
  const { data } = useJson<{ sittings: Sitting[]; knocks: Knock[] }>("/api/sit");
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setChromeHidden(true);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(t);
      setChromeHidden(false);
    };
  }, [setChromeHidden]);

  const knock = data?.knocks.find((k) => k.id === id);
  const sitting = data?.sittings.find((s) => s.id === id);
  const valid = Boolean(knock || sitting);
  const title = sitting?.title ?? (knock ? `${callName(members.find((m) => m.id === knock.memberId))}'s courtyard` : "Sitting together");
  const people = members.filter((m) => m.role !== "child");

  const leave = async () => {
    if (knock?.memberId === viewer.id) await postJson("/api/sit", { action: "unknock" });
    router.replace("/");
  };

  return (
    <div className="lite-ground fixed inset-0 z-40 flex flex-col">
      <header className="flex items-center gap-3 px-4" style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}>
        <button type="button" onClick={() => void leave()} aria-label="Leave" className="press grid h-11 w-11 place-items-center rounded-full bg-white/10">
          <Icon name="back" size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="m-0 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#7be3a6]">
            <span className="h-2 w-2 rounded-full bg-[#7be3a6]" /> Sitting together
          </p>
          <h1 className="m-0 truncate text-[19px] text-white">{title}</h1>
        </div>
      </header>
      <ul className="no-scrollbar m-0 flex list-none gap-3 overflow-x-auto px-4 py-3" aria-label="Family clocks">
        {people.map((m) => (
          <li key={m.id} className="flex shrink-0 items-center gap-2 rounded-full bg-white/8 py-1 pl-1 pr-3 ring-1 ring-white/10">
            <Avatar src={memberPhoto(m)} name={callName(m)} size={28} />
            <span className="text-[12.5px] leading-tight text-white/85">
              <span className="block font-semibold">{m.id === viewer.id ? "You" : callName(m)}</span>
              <span className="block text-white/55" suppressHydrationWarning>
                {now ? timeIn(m.tz, now) : ""} · {m.city || placeFromTz(m.tz)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="relative mx-3 mb-3 flex-1 overflow-hidden rounded-[26px] bg-black ring-1 ring-white/10" style={{ marginBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        {data === null ? (
          <div className="grid h-full place-items-center text-white/60">Opening the room…</div>
        ) : valid ? (
          <iframe
            title="Family video call"
            src={`${roomUrl(id)}#config.prejoinConfig.enabled=false&userInfo.displayName=%22${encodeURIComponent(callName(viewer))}%22`}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="grid h-full place-items-center px-8 text-center text-white/70">This sitting has ended. Start a new one from the courtyard.</div>
        )}
        {valid && (
          <a href={roomUrl(id)} target="_blank" rel="noreferrer" className="glass-dark absolute right-3 top-3 flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-white no-underline">
            Open in browser
          </a>
        )}
      </div>
    </div>
  );
}
