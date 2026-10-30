"use client";

import { useRef, useState } from "react";
import { processImage } from "@/lib/media-client";
import { getSessionMedia } from "@/lib/media-session";
import type { Member, RitualRun } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { Icon } from "./ui/kit";

// A photo wish: pick a photo, it becomes a card and a wish on the
// occasion's run, so it plays as a slide in the garland on the day.
export function PhotoWishButton({ run, viewer, forName, onDone, className }: { run: RitualRun; viewer: Member; forName: string; onDone?: () => void; className?: string }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const send = async (file: File) => {
    setState("busy");
    try {
      const upload = await processImage(file, { fromToday: false, fromGlassesToggle: false });
      const form = new FormData();
      form.append("type", "photo");
      form.append("caption", `A wish for ${forName}`);
      form.append("lang", viewer.lang);
      form.append("takenAt", upload.takenAt);
      form.append("source", upload.source);
      form.append("peaks", "[]");
      form.append("palette", JSON.stringify(upload.palette));
      form.append("taggedNames", "[]");
      form.append("media", getSessionMedia(upload.mediaRef)?.blob ?? file, "media");
      const res = await fetch("/api/cards", { method: "POST", body: form });
      const card = res.ok ? ((await res.json()) as { card?: { id?: string } }).card : undefined;
      if (!card?.id) throw new Error("card-failed");
      const wish = await fetch("/api/wishes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ritualRunId: run.id, cardId: card.id, memberId: viewer.id, kind: viewer.role === "elder" ? "blessing" : "wish" }),
      });
      if (!wish.ok) throw new Error("wish-failed");
      setState("done");
      onDone?.();
    } catch {
      setState("failed");
    }
  };
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={state === "busy" || state === "done"}
        aria-label={state === "failed" ? `Couldn't send. Try a photo wish for ${forName} again` : state === "done" ? "Photo wish sent" : `Send a photo wish for ${forName}`}
        className={cn("press grid shrink-0 place-items-center rounded-full disabled:opacity-60", state === "failed" && "ring-2 ring-[#b42318]", className)}
      >
        <Icon name={state === "done" ? "check" : "camera"} size={18} />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void send(f);
        }}
      />
    </>
  );
}
