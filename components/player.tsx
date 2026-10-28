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
import { AnimatePresence, motion } from "framer-motion";
import { strings } from "@/lib/i18n";
import { resolveMediaUrl } from "@/lib/media-session";
import type { Card } from "@/lib/schemas";
import { estimateSegments, formatHeardTime } from "@/lib/voice";
import { useDisplayText } from "@/lib/use-display-text";
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
      <MiniPlayer />
      <FullPlayer analyserRef={analyserRef} />
    </PlayerContext.Provider>
  );
}

// The waveform IS the scrubber: played bars in warm amber, the rest dim.
// Pointer down/drag seeks. Live analyser waves when real audio plays.
function WaveScrubber({
  card,
  analyserRef,
}: {
  card: Card;
  analyserRef: React.MutableRefObject<{ ctx: AudioContext; analyser: AnalyserNode } | null>;
}) {
  const { currentTime, duration, seek, isPlaying } = usePlayer();
  const { displayLang } = useViewer();
  const url = resolveMediaUrl(card.mediaRef);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  const dragRef = useRef(false);

  const peaks = useMemo(() => {
    const p = card.peaks.length >= 24 ? card.peaks : new Array(48).fill(0.4);
    return p.slice(0, 48);
  }, [card.peaks]);

  // Live waves from the AnalyserNode while real audio plays.
  useEffect(() => {
    const canvas = canvasRef.current;
    const entry = analyserRef.current;
    if (!canvas || !url || !isPlaying || !entry) {
      setLive(false);
      return;
    }
    setLive(true);
    const { ctx, analyser } = entry;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    let raf = 0;
    const draw = () => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const g = canvas.getContext("2d");
      if (g) {
        const w = canvas.width;
        const h = canvas.height;
        g.clearRect(0, 0, w, h);
        const n = 48;
        const bw = w / n;
        for (let i = 0; i < n; i++) {
          const v = data[Math.floor((i / n) * data.length)] / 255;
          const bh = Math.max(3, v * h);
          const played = (i / n) * duration <= currentTime;
          g.fillStyle = played ? "#FDBA74" : "rgba(253,186,116,0.35)";
          g.fillRect(i * bw + 1, (h - bh) / 2, Math.max(1, bw - 2), bh);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [url, isPlaying, analyserRef, duration, currentTime]);

  const ratioToTime = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    return ratio * duration;
  };

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  return (
    <div>
      <div
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(currentTime + 2);
          if (e.key === "ArrowLeft") seek(currentTime - 2);
        }}
        onPointerDown={(e) => {
          dragRef.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          seek(ratioToTime(e.clientX, e.currentTarget));
        }}
        onPointerMove={(e) => {
          if (dragRef.current) seek(ratioToTime(e.clientX, e.currentTarget));
        }}
        onPointerUp={() => {
          dragRef.current = false;
        }}
        className="tap flex h-16 w-full cursor-pointer items-center"
      >
        {live ? (
          <canvas ref={canvasRef} width={480} height={64} className="h-16 w-full" aria-hidden="true" />
        ) : (
          <div className="flex h-16 w-full items-center gap-[2px]" aria-hidden="true">
            {peaks.map((p, i) => {
              const played = i / peaks.length <= progress;
              return (
                <span
                  key={i}
                  className="min-w-[2px] flex-1 rounded-full"
                  style={{
                    height: `${Math.max(6, Math.round(Number(p) * 56))}px`,
                    background: played ? "#FDBA74" : "rgba(253,186,116,0.35)",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[12px] tabular-nums text-[var(--player-muted)]" aria-hidden="true">
        <span>{formatHeardTime(new Date(currentTime * 1000).toISOString())}</span>
        <span>{formatHeardTime(new Date(duration * 1000).toISOString())}</span>
      </div>
      <span className="sr-only">
        {displayLang === "en" ? "Audio progress" : "progress"}
      </span>
    </div>
  );
}

function MiniPlayer() {
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
          aria-current={i === active ? "true" : undefined}
          className={
            i === active
              ? "serif text-[26px] leading-snug text-[var(--player-ink)]"
              : "serif mt-1 text-[17px] leading-snug text-[var(--player-muted)]"
          }
        >
          {l.text}
        </li>
      ))}
    </ol>
  );
}

// Full-screen dark Now Playing. The waveform is the scrubber; reactions are
// text buttons. Glass is not used here — the ground is solid #2A211C.
function FullPlayer({
  analyserRef,
}: {
  analyserRef: React.MutableRefObject<{ ctx: AudioContext; analyser: AnalyserNode } | null>;
}) {
  const { current, open, isPlaying, currentTime, duration, toggle, collapse, closePlayer } = usePlayer();
  const { displayLang } = useViewer();
  const t = strings(displayLang);
  const { text: caption, translated } = useDisplayText(current?.caption ?? "", current?.lang, displayLang);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") collapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, collapse]);

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t.player.nowPlaying}
          className="fixed inset-0 z-50 flex justify-center bg-[var(--player-ground)] text-[var(--player-ink)]"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex max-h-full w-full max-w-[480px] flex-col overflow-y-auto px-5 pb-8 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="m-0 text-[13px] font-medium text-[var(--player-muted)]">{t.player.nowPlaying}</p>
              <button
                type="button"
                onClick={collapse}
                aria-label={t.player.close}
                className="tap flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="serif m-0 text-xl leading-snug">{caption ?? "…"}</p>
            {translated && (
              <p className="m-0 mt-1 text-[12px] font-semibold text-[var(--player-wave)]">{t.player.translatedNote}</p>
            )}
            <div className="mt-2 text-[var(--player-muted)]" style={{ ["--ink-soft" as string]: "var(--player-muted)" }}>
              <HeardChip cardId={current.id} />
            </div>
            <div className="mt-4">
              <WaveScrubber card={current} analyserRef={analyserRef} />
            </div>
            <div className="mb-5 mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={toggle}
                className="tap flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-ink"
                aria-label={isPlaying ? t.player.pause : t.player.play}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>
            </div>
            <h2 className="mb-2 mt-0 text-sm font-semibold text-[var(--player-muted)]">{t.player.lyrics}</h2>
            <div className="mb-5">
              <SyncedLyrics card={current} duration={duration} currentTime={currentTime} />
            </div>
            <div className="mb-6" style={{ ["--accent" as string]: "var(--player-wave)" }}>
              <ReactionBar cardId={current.id} />
            </div>
            <button
              type="button"
              onClick={closePlayer}
              className="tap w-full rounded-card border border-white/25 text-sm font-semibold"
            >
              {t.player.close}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
