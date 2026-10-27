"use client";

import { useEffect, useRef, useState } from "react";
import { ASK_STARTERS, strings } from "@/lib/i18n";
import { processImage, processVideo, type ProcessedUpload } from "@/lib/media-client";
import { cn } from "@/lib/utils";
import { useShell } from "./shell";
import { GlassSheet } from "./ui/glass";
import { PrimaryButton } from "./ui/buttons";
import { useViewer } from "./viewer";

export type AddTab = "photos" | "voice" | "video" | "ask";

async function postCard(upload: ProcessedUpload, caption: string, lang: string): Promise<boolean> {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: upload.kind === "video" ? "video" : "photo",
      caption,
      lang,
      takenAt: upload.takenAt,
      source: upload.source,
      mediaRef: upload.mediaRef,
      peaks: upload.peaks,
      palette: upload.palette,
    }),
  });
  return res.ok;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="tap flex items-center gap-2 text-sm"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-7 w-12 items-center rounded-pill border border-ink/20 px-1 transition-colors",
          checked ? "justify-end bg-espresso" : "justify-start bg-surface",
        )}
      >
        <span className={cn("h-5 w-5 rounded-full", checked ? "bg-espresso-ink" : "bg-ink/30")} />
      </span>
      {label}
    </button>
  );
}

export function AddSheet() {
  const { addOpen, addTab, closeAdd, bumpRefresh } = useShell();
  const { viewer, lang } = useViewer();
  const t = strings(lang);
  const [tab, setTab] = useState<AddTab>("photos");
  const [files, setFiles] = useState<File[]>([]);
  const [fromToday, setFromToday] = useState(true);
  const [glasses, setGlasses] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addOpen) {
      setTab(addTab);
      setFiles([]);
      setCaption("");
      setErrors([]);
      setBusy(false);
    }
  }, [addOpen, addTab]);

  const share = async (kind: "photos" | "video") => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setErrors([]);
    const failures: string[] = [];
    let posted = 0;
    const list = kind === "video" ? files.slice(0, 1) : files;
    for (const file of list) {
      try {
        const upload =
          kind === "video"
            ? await processVideo(file, { fromToday, fromGlassesToggle: glasses })
            : await processImage(file, { fromToday, fromGlassesToggle: glasses });
        const ok = await postCard(upload, caption.trim(), viewer.lang);
        if (ok) posted += 1;
        else failures.push(file.name);
      } catch {
        failures.push(file.name);
      }
    }
    setBusy(false);
    setErrors(failures);
    if (posted > 0) {
      bumpRefresh();
      if (failures.length === 0) closeAdd();
    }
  };

  const tabs: { key: AddTab; label: string }[] = [
    { key: "photos", label: t.add.photos },
    { key: "voice", label: t.add.voice },
    { key: "video", label: t.add.video },
    { key: "ask", label: t.add.ask },
  ];

  return (
    <GlassSheet open={addOpen} onClose={closeAdd} label={t.add.title}>
      <h2 className="mb-3 mt-0 pr-10 text-2xl font-normal">{t.add.title}</h2>
      <div className="mb-4 flex gap-2" role="tablist" aria-label={t.add.title}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            role="tab"
            aria-selected={tab === tb.key}
            onClick={() => {
              setTab(tb.key);
              setFiles([]);
              setErrors([]);
            }}
            className={cn(
              "tap flex-1 rounded-pill text-sm font-semibold",
              tab === tb.key ? "bg-espresso text-espresso-ink" : "border border-ink/20",
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {(tab === "photos" || tab === "video") && (
        <div>
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
            <Toggle checked={fromToday} onChange={setFromToday} label={t.add.fromToday} />
            <Toggle checked={glasses} onChange={setGlasses} label={t.add.fromGlasses} />
          </div>
          <button
            type="button"
            onClick={() => (tab === "photos" ? photoRef.current?.click() : videoRef.current?.click())}
            className="tap w-full rounded-card border-2 border-dashed border-ink/20 py-4 text-[15px] text-ink-soft"
          >
            {files.length === 0 ? t.tabs.add : `${files.length} ✓`}
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-label={t.add.photos}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            aria-label={t.add.video}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {tab === "video" && <p className="mt-2 text-[13px] text-ink-soft">≤30s · ≤25 MB</p>}
          <label className="mt-3 block text-sm font-medium">
            <span className="sr-only">{t.add.captionPlaceholder}</span>
            <input
              type="text"
              value={caption}
              maxLength={280}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t.add.captionPlaceholder}
              className="tap mt-1 w-full rounded-card border border-line bg-surface/80 px-4 text-[15px]"
            />
          </label>
          {errors.length > 0 && (
            <p className="mt-2 text-sm text-accent" role="alert">
              {errors.join(", ")}
            </p>
          )}
          <PrimaryButton className="mt-4 w-full" disabled={busy || files.length === 0} onClick={() => void share(tab)}>
            {busy ? t.add.processing : t.add.share}
          </PrimaryButton>
        </div>
      )}

      {tab === "voice" && <p className="text-[15px] text-ink-soft">{t.add.voiceSoon}</p>}

      {tab === "ask" && (
        <div>
          <p className="mt-0 text-[15px] text-ink-soft">{t.add.askSoon}</p>
          <ul className="m-0 list-none p-0">
            {ASK_STARTERS[lang].map((q) => (
              <li key={q} className="serif mb-2 rounded-card border border-line bg-surface/60 px-4 py-3 text-[15px]">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassSheet>
  );
}
