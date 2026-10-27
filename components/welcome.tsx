"use client";

import { useEffect, useRef, useState } from "react";
import { greetingForHour, strings } from "@/lib/i18n";
import { resolveHomeImage } from "@/lib/media";
import { processHomeImage } from "@/lib/media-client";
import { resolveMediaUrl } from "@/lib/media-session";
import { OutlineButton, PrimaryButton } from "./ui/buttons";
import { CourtyardArt } from "./courtyard-art";
import { useShell } from "./shell";
import { DEMO_FAMILY, useViewer } from "./viewer";

// AI-generated fallback courtyard (see public/demo/README.md). The SVG
// courtyard stays as an offline fallback if this image fails to load.
const FALLBACK_COURTYARD_SRC = "/demo/courtyard.jpg";

// Welcome screen, shown once per session. Renders inside the centred
// phone-width column — nothing full-bleed beyond it — over the wash.
export function Welcome({ onEnter }: { onEnter: () => void }) {
  const { viewer, lang, signalLine, refreshMembers } = useViewer();
  const { setWashPalette } = useShell();
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

  useEffect(() => {
    setWashPalette(viewer.homePalette.length >= 3 ? viewer.homePalette : []);
  }, [viewer.homePalette, setWashPalette]);

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
      setWashPalette(palette);
      await refreshMembers();
    } catch {
      setError(t.common.retry);
    } finally {
      setSaving(false);
    }
  };

  const greeting = t.greeting[greetingForHour(hour ?? 9)];

  return (
    <div className="fixed inset-0 z-[60] flex justify-center">
      <div className="relative h-full w-full max-w-[480px] overflow-hidden sm:shadow-[0_0_80px_rgba(60,40,30,0.25)]">
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
          <div className="glass glass-sheet mx-auto w-full p-6">
            <p className="m-0 text-sm text-ink-soft">{greeting}</p>
            <h1 className="mb-1 mt-1 text-3xl font-normal leading-tight">{t.welcomeTo(viewer.firstName)}</h1>
            <p className="mb-4 mt-0 text-[15px] text-ink-soft">{signalLine}</p>
            {!homeRef && (
              <div className="mb-4">
                <p className="m-0 text-sm font-semibold">{t.addHomeTitle}</p>
                <p className="m-0 mt-1 text-[13px] text-ink-soft">{t.addHomeHint}</p>
              </div>
            )}
            {error && (
              <p className="mb-3 mt-0 text-sm text-accent" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <OutlineButton className="flex-1" disabled={saving} onClick={() => fileRef.current?.click()}>
                {t.changeHome}
              </OutlineButton>
              <PrimaryButton className="flex-1" onClick={onEnter}>
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
