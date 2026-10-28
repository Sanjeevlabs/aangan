"use client";

import { useEffect, useRef, useState } from "react";
import { ASK_STARTERS, strings } from "@/lib/i18n";
import { processImage, processVideo, processVoiceBlob, type ProcessedUpload } from "@/lib/media-client";
import type { TranscriptSegment } from "@/lib/schemas";
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

async function postVoiceCard(input: {
  upload: ProcessedUpload;
  caption: string;
  transcript: string;
  transcriptLang: string;
  segments: TranscriptSegment[];
}): Promise<boolean> {
  const res = await fetch("/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: "audio",
      caption: input.caption.slice(0, 280),
      lang: input.transcriptLang,
      takenAt: input.upload.takenAt,
      source: input.upload.source,
      mediaRef: input.upload.mediaRef,
      peaks: input.upload.peaks,
      palette: input.upload.palette,
      transcript: input.transcript.slice(0, 2000),
      transcriptLang: input.transcriptLang,
      segments: input.segments.slice(0, 64),
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
          "flex h-7 w-12 items-center rounded-card border-2 px-1 transition-colors",
          checked ? "justify-end border-espresso bg-espresso" : "justify-start border-ink/40 bg-ink/10",
        )}
      >
        <span className={cn("h-5 w-5 rounded-full", checked ? "bg-espresso-ink" : "bg-ink-soft")} />
      </span>
      {label}
    </button>
  );
}

const CONSENT_KEY = "aangan:voice-consent";

interface VoiceReady {
  upload: ProcessedUpload;
  url: string;
  transcript: string;
  transcriptLang: string;
  segments: TranscriptSegment[];
}

function VoiceTab({ onPosted }: { onPosted: () => void }) {
  const { viewer, lang } = useViewer();
  const t = strings(lang);
  const [phase, setPhase] = useState<"idle" | "recording" | "ready">("idle");
  const [consent, setConsent] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<VoiceReady | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    try {
      setConsent(localStorage.getItem(CONSENT_KEY) === "1");
    } catch {
      setConsent(false);
    }
  }, []);

  useEffect(
    () => () => {
      recorderRef.current?.stream?.getTracks().forEach((tr) => tr.stop());
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      if (ready) URL.revokeObjectURL(ready.url);
    },
    [ready],
  );

  const giveConsent = (v: boolean) => {
    setConsent(v);
    try {
      if (v) localStorage.setItem(CONSENT_KEY, "1");
      else localStorage.removeItem(CONSENT_KEY);
    } catch {
      // Private mode: consent lasts for this session only.
    }
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm", "audio/mp4"].find((m) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void finish(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      };
      recorderRef.current = rec;
      rec.start();
      setPhase("recording");
    } catch {
      setError(t.common.retry);
    }
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      setBusy(true);
      rec.stop();
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const finish = async (blob: Blob) => {
    try {
      const upload = await processVoiceBlob(blob, { fromToday: true, fromGlassesToggle: false });
      const url = upload.previewUrl ?? "";
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audioId: upload.mediaRef, langHint: viewer.displayLang ?? lang }),
      });
      if (!res.ok) throw new Error("transcribe-failed");
      const data = (await res.json()) as {
        transcript: { transcript: string; language: string; summary: string; segments: TranscriptSegment[] };
      };
      setReady({
        upload,
        url,
        transcript: data.transcript.transcript,
        transcriptLang: data.transcript.language,
        segments: data.transcript.segments ?? [],
      });
      setCaption(data.transcript.summary);
      setPhase("ready");
    } catch {
      setError(t.common.retry);
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const text = caption.trim() || ready.transcript;
    const ok = await postVoiceCard({
      upload: ready.upload,
      caption: text,
      transcript: ready.transcript,
      transcriptLang: ready.transcriptLang,
      segments: ready.segments,
    });
    setBusy(false);
    if (ok) {
      if (ready.url) URL.revokeObjectURL(ready.url);
      setReady(null);
      setCaption("");
      setPhase("idle");
      onPosted();
    } else {
      setError(t.common.retry);
    }
  };

  if (typeof navigator !== "undefined" && !navigator.mediaDevices) {
    return <p className="text-[15px] text-ink-soft">{t.common.retry}</p>;
  }

  return (
    <div>
      <label className="tap mb-3 flex items-start gap-2 text-[13px] text-ink-soft">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => giveConsent(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>{t.voice.consent}</span>
      </label>
      {phase === "idle" && (
        <PrimaryButton className="w-full" disabled={busy || !consent} onClick={() => void start()}>
          {busy ? t.add.processing : t.voice.record}
        </PrimaryButton>
      )}
      {phase === "recording" && (
        <div>
          <p className="serif mb-3 text-lg" role="status">
            ● {t.voice.stop}…
          </p>
          <PrimaryButton className="w-full" disabled={busy} onClick={stop}>
            {t.voice.stop}
          </PrimaryButton>
        </div>
      )}
      {phase === "ready" && ready && (
        <div>
          <p className="mb-2 text-sm font-medium">{t.voice.preview}</p>
          {ready.url ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio src={ready.url} controls className="tap w-full" preload="auto" />
          ) : (
            <div className="skeleton h-12" aria-busy="true" aria-label={t.add.processing} />
          )}
          <p className="serif mt-3 line-clamp-3 text-[15px] leading-snug">{ready.transcript}</p>
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
          {error && (
            <p className="mt-2 text-sm text-accent" role="alert">
              {error}
            </p>
          )}
          <PrimaryButton className="mt-4 w-full" disabled={busy} onClick={() => void share()}>
            {busy ? t.add.processing : t.voice.useRecording}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => {
              if (ready.url) URL.revokeObjectURL(ready.url);
              setReady(null);
              setCaption("");
              setPhase("idle");
            }}
            className="tap mt-2 w-full text-sm font-semibold text-accent"
          >
            {t.voice.recordAgain}
          </button>
        </div>
      )}
      {phase === "idle" && error && (
        <p className="mt-2 text-sm text-accent" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function AskTab() {
  const { viewer, lang } = useViewer();
  const t = strings(lang);
  const [suggested, setSuggested] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setSuggested(null);
    setFailed(false);
    fetch(
      `/api/suggest?memberId=${encodeURIComponent(viewer.id)}&displayLang=${encodeURIComponent(viewer.displayLang ?? lang)}`,
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { questions?: string[] } | null) => {
        if (!live) return;
        if (data?.questions) setSuggested(data.questions);
        else setFailed(true);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [viewer.id, viewer.displayLang, lang]);

  return (
    <div>
      <p className="mt-0 text-[15px] text-ink-soft">{t.voice.suggested}</p>
      {suggested === null && !failed && (
        <div aria-busy="true" aria-label={t.add.processing}>
          <div className="skeleton mb-2 h-14" />
          <div className="skeleton mb-2 h-14" />
          <div className="skeleton h-14" />
        </div>
      )}
      {suggested !== null && (
        <ul className="m-0 list-none p-0">
          {suggested.map((q) => (
            <li key={q} className="serif mb-2 rounded-card border border-line bg-surface/60 px-4 py-3 text-[15px]">
              {q}
            </li>
          ))}
        </ul>
      )}
      {(failed || suggested !== null) && (
        <>
          <p className="mt-4 text-[15px] text-ink-soft">{t.add.askSoon}</p>
          <ul className="m-0 list-none p-0">
            {ASK_STARTERS[lang].map((q) => (
              <li key={q} className="serif mb-2 rounded-card border border-line bg-surface/60 px-4 py-3 text-[15px]">
                {q}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
              "tap flex-1 rounded-card text-sm font-semibold",
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

      {tab === "voice" && (
        <VoiceTab
          onPosted={() => {
            bumpRefresh();
            closeAdd();
          }}
        />
      )}

      {tab === "ask" && <AskTab />}
    </GlassSheet>
  );
}
