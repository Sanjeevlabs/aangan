"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { strings } from "@/lib/i18n";
import { resolveMediaUrl } from "@/lib/media-session";
import type { Card } from "@/lib/schemas";
import { estimateSegments, needsDisplayText } from "@/lib/voice";
import { useDisplayText } from "@/lib/use-display-text";
import { GlassSheet } from "./ui/glass";
import { HeardChip, ReactionBar } from "./reactions";
import { useViewer } from "./viewer";

interface PlayerState {
  current: Card | null;
  open: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: (card: Card) => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  expand: () => void;
  collapse: () => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerState | null>(null);

export function usePlayer(): PlayerState {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}

function segmentsMax(card: Card): number {
  return card.segments.reduce((m, s) => Math.max(m, s.end), 0);
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { viewer } = useViewer();
  const [current, setCurrent] = useState<Card | null>(null);
  const [open, setOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(12);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  const url = current ? resolveMediaUrl(current.mediaRef) : null;

  const stopSimulated = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopWaves = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Real audio element, created lazily for uploads with a session URL.
  useEffect(() => {
    if (!url) return;
    const audio = new Audio(url);
    audio.preload = "auto";
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 12);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [url]);

  // Web Audio graph for live frequency waves: source -> analyser ->
  // destination, built once per audio URL.
  useEffect(() => {
    if (!url || !audioRef.current || analyserRef.current) return;
    try {
      const Ctx = window.AudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = { ctx, analyser };
    } catch {
      analyserRef.current = null;
    }
    return () => {
      analyserRef.current?.ctx.close().catch(() => undefined);
      analyserRef.current = null;
    };
  }, [url]);

  // Simulated clock for demo cards without audio bytes.
  useEffect(() => {
    if (!current || url) return;
    if (!isPlaying) {
      stopSimulated();
      return;
    }
    timerRef.current = window.setInterval(() => {
      setCurrentTime((t) => {
        const next = t + 0.25;
        if (next >= duration) {
          setIsPlaying(false);
          stopSimulated();
          return duration;
        }
        return next;
      });
    }, 250);
    return stopSimulated;
  }, [current, url, isPlaying, duration, stopSimulated]);

  useEffect(() => stopSimulated, [stopSimulated]);
  useEffect(() => stopWaves, [stopWaves]);

  const play = useCallback(
    (card: Card) => {
      stopSimulated();
      audioRef.current?.pause();
      setCurrent(card);
      setCurrentTime(0);
      setDuration(Math.max(12, segmentsMax(card)));
      setIsPlaying(true);
      setOpen(true);
      // Heard loop: record the play, fire-and-forget.
      void fetch("/api/plays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, memberId: viewer.id }),
      }).catch(() => undefined);
    },
    [stopSimulated, viewer.id],
  );

  const toggle = useCallback(() => {
    if (!current) return;
    if (audioRef.current && url) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        void audioRef.current.play().then(
          () => setIsPlaying(true),
          () => setIsPlaying(false),
        );
      }
      return;
    }
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (currentTime >= duration) setCurrentTime(0);
    setIsPlaying(true);
  }, [current, url, isPlaying, currentTime, duration]);

  const seek = useCallback(
    (seconds: number) => {
      const v = Math.max(0, Math.min(duration, seconds));
      if (audioRef.current && url) audioRef.current.currentTime = v;
      setCurrentTime(v);
    },
    [duration, url],
  );

  const expand = useCallback(() => setOpen(true), []);
  const collapse = useCallback(() => setOpen(false), []);
  const closePlayer = useCallback(() => {
    audioRef.current?.pause();
    stopSimulated();
    stopWaves();
    setIsPlaying(false);
    setCurrent(null);
    setOpen(false);
  }, [stopSimulated, stopWaves]);

  // Drive real-audio playback from isPlaying (set by play()).
  useEffect(() => {
    if (!audioRef.current || !url || !current) return;
    if (isPlaying && audioRef.current.paused) {
      void audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [isPlaying, url, current]);

  const value = useMemo<PlayerState>(
    () => ({
      current,
      open,
      isPlaying,
      currentTime,
      duration,
      play,
      toggle,
      seek,
      expand,
      collapse,
      closePlayer,
    }),
    [current, open, isPlaying, currentTime, duration, play, toggle, seek, expand, collapse, closePlayer],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <MiniPlayer
        canvasRef={canvasRef}
        analyserRef={analyserRef}
        rafRef={rafRef}
        stopWaves={stopWaves}
      />
      <FullPlayer
        canvasRef={canvasRef}
        analyserRef={analyserRef}
        rafRef={rafRef}
        stopWaves={stopWaves}
      />
    </PlayerContext.Provider>
  );
}

interface WaveRefs {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  analyserRef: React.MutableRefObject<{ ctx: AudioContext; analyser: AnalyserNode } | null>;
  rafRef: React.MutableRefObject<number | null>;
  stopWaves: () => void;
}

// Live voice frequency waves via Web Audio AnalyserNode when real audio
// plays; stored peaks render when static.
function LiveWaves({
  isPlaying,
  url,
  peaks,
  canvasRef,
  analyserRef,
  rafRef,
  stopWaves,
}: WaveRefs & { isPlaying: boolean; url: string | null; peaks: number[] }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const entry = analyserRef.current;
    if (!canvas || !url || !isPlaying || !entry) {
      stopWaves();
      return;
    }
    const { ctx, analyser } = entry;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const draw = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const g = canvas.getContext("2d");
      if (g) {
        const w = canvas.width;
        const h = canvas.height;
        g.clearRect(0, 0, w, h);
        const n = 24;
        const bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = data[Math.floor((i / n) * data.length)] / 255;
          const bh = Math.max(3, v * h);
          g.fillStyle = "rgba(255,248,240,0.9)";
          g.fillRect(i * bw + 1, (h - bh) / 2, bw - 2, bh);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return stopWaves;
  }, [isPlaying, url, canvasRef, analyserRef, rafRef, stopWaves]);

  if (url && isPlaying) {
    return <canvas ref={canvasRef} width={220} height={48} aria-hidden="true" className="h-12 w-56" />;
  }
  const bars = peaks.filter((_, i) => i % 2 === 0).slice(0, 24);
  return (
    <div className="flex h-12 w-56 items-center justify-center gap-[3px]" aria-hidden="true">
      {(bars.length > 0 ? bars : new Array(24).fill(0.4)).map((p, i) => (
        <span
          key={i}
          className="w-[4px] rounded-full bg-white/85"
          style={{ height: `${Math.max(5, Math.round(Number(p) * 44))}px` }}
        />
      ))}
    </div>
  );
}

function MiniPlayer(refs: WaveRefs) {
  const { current, open, isPlaying, toggle, expand, closePlayer } = usePlayer();
  const { displayLang } = useViewer();
  const t = strings(displayLang);
  const { text } = useDisplayText(current?.caption ?? "", current?.lang, displayLang);

  if (!current || open) return null;
  return (
    <div
      className="glass glass-pill fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(94vw,26rem)] -translate-x-1/2 items-center gap-3 px-4 py-2"
      role="region"
      aria-label={t.player.nowPlaying}
    >
      <button
        type="button"
        onClick={expand}
        className="tap min-w-0 flex-1 truncate text-left text-sm font-semibold"
        aria-label={t.player.nowPlaying}
      >
        {text ?? "…"}
      </button>
      <button
        type="button"
        onClick={toggle}
        className="tap flex h-11 w-11 items-center justify-center rounded-full bg-espresso text-lg text-espresso-ink"
        aria-label={isPlaying ? t.player.pause : t.player.play}
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        onClick={closePlayer}
        className="tap flex h-11 w-11 items-center justify-center rounded-full border border-line text-lg"
        aria-label={t.player.close}
      >
        ×
      </button>
    </div>
  );
}

function SyncedLyrics({ card, duration, currentTime }: { card: Card; duration: number; currentTime: number }) {
  const { displayLang } = useViewer();
  const source = card.transcript || card.caption;
  const sourceLang = card.transcript ? card.transcriptLang : card.lang;
  const { text: translated, translated: wasTranslated } = useDisplayText(source, sourceLang, displayLang);

  const lines = useMemo(() => {
    if (!wasTranslated && card.segments.length > 0 && card.transcript) return card.segments;
    if (translated === null) return null;
    return estimateSegments(translated, duration);
  }, [wasTranslated, card.segments, card.transcript, translated, duration]);

  if (lines === null) {
    return (
      <div aria-busy="true" aria-label="Loading">
        <div className="skeleton mb-2 h-6" />
        <div className="skeleton h-6 w-2/3" />
      </div>
    );
  }
  let active = 0;
  lines.forEach((l, i) => {
    if (currentTime >= l.start) active = i;
  });
  return (
    <ol className="m-0 list-none p-0">
      {lines.map((l, i) => (
        <li
          key={i}
          className={
            i === active
              ? "serif text-[17px] font-semibold leading-snug"
              : "serif text-[15px] leading-snug text-ink-soft"
          }
        >
          {l.text}
        </li>
      ))}
    </ol>
  );
}

function FullPlayer(refs: WaveRefs) {
  const { current, open, isPlaying, currentTime, duration, toggle, seek, collapse, closePlayer } = usePlayer();
  const { displayLang } = useViewer();
  const t = strings(displayLang);
  const { text: caption, translated } = useDisplayText(current?.caption ?? "", current?.lang, displayLang);

  const palette = current && current.palette.length >= 3 ? current.palette : ["#c96f4a", "#e8a87c", "#f4d8b4"];
  const artUrl = current && current.type === "photo" ? resolveMediaUrl(current.mediaRef) : null;
  const audioUrl = current ? resolveMediaUrl(current.mediaRef) : null;

  return (
    <GlassSheet open={open && current !== null} onClose={collapse} label={t.player.nowPlaying}>
      {current && (
        <div>
          <h2 className="mb-3 mt-0 pr-10 text-2xl font-normal">{t.player.nowPlaying}</h2>
          <div className="art-square mb-3 bg-skeleton">
            {artUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]} 55%, ${palette[2]})` }}
                aria-hidden="true"
              >
                {audioUrl && isPlaying ? (
                  <LiveWaves
                    isPlaying={isPlaying}
                    url={audioUrl}
                    peaks={current.peaks}
                    canvasRef={refs.canvasRef}
                    analyserRef={refs.analyserRef}
                    rafRef={refs.rafRef}
                    stopWaves={refs.stopWaves}
                  />
                ) : (
                  <div className="flex h-12 items-center gap-[3px]">
                    {(current.peaks.filter((_, i) => i % 2 === 0).slice(0, 24).length > 0
                      ? current.peaks.filter((_, i) => i % 2 === 0).slice(0, 24)
                      : new Array(24).fill(0.4)
                    ).map((p, i) => (
                      <span
                        key={i}
                        className="w-[4px] rounded-full bg-white/85"
                        style={{ height: `${Math.max(6, Math.round(Number(p) * 44))}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="serif m-0 text-lg leading-snug">{caption ?? "…"}</p>
          {translated && (
            <p className="m-0 mt-1 text-[12px] font-semibold text-accent">{t.player.translatedNote}</p>
          )}
          <div className="mb-1 mt-3 flex items-center gap-2">
            <HeardChip cardId={current.id} />
          </div>
          <label className="mt-2 block text-sm font-medium">
            <span className="sr-only">{t.player.lyrics}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={0.25}
              value={Math.min(currentTime, duration)}
              onChange={(e) => seek(Number(e.target.value))}
              className="tap w-full"
              aria-label={t.player.lyrics}
            />
          </label>
          <div className="mb-3 flex justify-between text-[12px] text-ink-soft" aria-hidden="true">
            <span>{currentTime.toFixed(0)}s</span>
            <span>{duration.toFixed(0)}s</span>
          </div>
          <div className="glass glass-pill mb-4 flex items-center justify-center gap-3 px-4 py-2">
            <button
              type="button"
              onClick={toggle}
              className="tap flex h-12 w-12 items-center justify-center rounded-full bg-espresso text-xl text-espresso-ink"
              aria-label={isPlaying ? t.player.pause : t.player.play}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
          </div>
          <h3 className="mb-2 mt-0 text-base font-semibold">{t.player.lyrics}</h3>
          <div className="mb-4">
            <SyncedLyrics card={current} duration={duration} currentTime={currentTime} />
          </div>
          <div className="mb-4">
            <ReactionBar cardId={current.id} />
          </div>
          <button
            type="button"
            onClick={closePlayer}
            className="tap w-full rounded-pill border border-line text-sm font-semibold"
          >
            {t.player.close}
          </button>
        </div>
      )}
    </GlassSheet>
  );
}
