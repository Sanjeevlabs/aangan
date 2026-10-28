"use client";

import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGS, displayLangLabel, greetingForHour, strings } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { resolveHomeImage } from "@/lib/media";
import { processHomeImage } from "@/lib/media-client";
import { resolveMediaUrl } from "@/lib/media-session";
import { OutlineButton, PrimaryButton } from "./ui/buttons";
import { CourtyardArt } from "./courtyard-art";
import { DEMO_FAMILY, useViewer } from "./viewer";

// AI-generated fallback courtyard (see public/demo/README.md). The SVG
// courtyard stays as an offline fallback if this image fails to load.
const FALLBACK_COURTYARD_SRC = "/demo/courtyard.jpg";

// Welcome screen, shown once per session. Full-bleed home image with a flat
// bottom card: greeting, serif welcome line, one warm signal line.
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const { viewer, lang, displayLang, setDisplayLang, refreshMembers } = useViewer();
  const t = strings(lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  const homeRef = resolveHomeImage(viewer.homeImageRef, DEMO_FAMILY.defaultHomeImageRef);
  const src = resolveMediaUrl(homeRef) ?? FALLBACK_COURTYARD_SRC;

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const pickHome = async (file: File | undefined) => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const { mediaRef, palette } = await processHomeImage(file);
      const res = await fetch("/api/members/home-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId: viewer.id, mediaRef, palette }),
      });
      if (!res.ok) throw new Error("home-save-failed");
      await refreshMembers();
    } catch {
      setError(t.common.retry);
    } finally {
      setSaving(false);
    }
  };

  const greeting = t.greeting[greetingForHour(hour ?? 9)];

  return (
    <div className="fixed inset-0 z-[60] flex justify-center bg-ink">
      <div className="relative h-full w-full max-w-[480px] overflow-hidden">
        {imgFailed ? (
          <CourtyardArt className="h-full w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0 p-4"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-full rounded-card bg-paper p-6 text-ink shadow-glass">
            <p className="m-0 text-sm text-ink-soft">{greeting}</p>
            <h1 className="mb-1 mt-1 text-3xl leading-tight">{t.welcomeTo(viewer.firstName)}</h1>
            {!homeRef && (
              <div className="mb-4">
                <p className="m-0 text-sm font-semibold">{t.addHomeTitle}</p>
                <p className="m-0 mt-1 text-[13px] text-ink-soft">{t.addHomeHint}</p>
              </div>
            )}
            <div className="mb-4">
              <p className="m-0 text-sm font-semibold">{t.speakToYou}</p>
              <div className="mt-2 flex gap-2" role="radiogroup" aria-label={t.speakToYou}>
                {SUPPORTED_LANGS.map((code) => (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={displayLang === code}
                    onClick={() => void setDisplayLang(code)}
                    className={cn(
                      "tap min-w-0 flex-1 basis-0 rounded-card border px-2 text-sm font-semibold",
                      displayLang === code
                        ? "border-espresso bg-espresso text-espresso-ink"
                        : "border-ink/25 bg-transparent",
                    )}
                  >
                    {displayLangLabel(code)}
                    <span className="block text-[11px] font-normal opacity-80">
                      {code === "en" ? "English" : code === "hi-latn" ? "Hindi in English letters" : "हिंदी"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="mb-3 mt-0 text-sm text-accent" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <OutlineButton
                className="min-w-0 flex-1 basis-0 overflow-hidden text-ellipsis whitespace-nowrap"
                disabled={saving}
                onClick={() => fileRef.current?.click()}
              >
                {t.changeHome}
              </OutlineButton>
              <PrimaryButton
                className="min-w-0 flex-1 basis-0 overflow-hidden text-ellipsis whitespace-nowrap"
                onClick={onEnter}
              >
                {t.stepInside}
              </PrimaryButton>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={t.addHomeTitle}
              onChange={(e) => {
                void pickHome(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
