"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- icons */
// One stroke family, 24px grid, 2px stroke. No text glyphs anywhere.
type IconName =
  | "play"
  | "pause"
  | "mic"
  | "camera"
  | "more"
  | "back"
  | "down"
  | "close"
  | "heart"
  | "laugh"
  | "bless"
  | "reply"
  | "lane"
  | "calendar"
  | "gather"
  | "tree"
  | "settings"
  | "plus"
  | "check"
  | "chevron"
  | "send"
  | "stop"
  | "image"
  | "pot"
  | "care"
  | "village"
  | "sparkle"
  | "door"
  | "sun"
  | "phone";

const PATHS: Record<IconName, React.ReactNode> = {
  play: <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  stop: <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="4" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8.5 6l1.5-2.5h4L15.5 6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-9 9" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  heart: <path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.9 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.4 0 5.7 3.3 4.5 6.7C19.5 15.4 12 20 12 20z" />,
  laugh: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 13.5a4.8 4.8 0 0 0 9 0z" fill="currentColor" stroke="none" />
      <path d="M8 9.5l1.5 1M16 9.5l-1.5 1" />
    </>
  ),
  bless: <path d="M12 4.5c-.9-1-2.4-.6-2.6.8L8.6 12l-3 3.2a2 2 0 0 0-.4 2.2L6.8 21M12 4.5c.9-1 2.4-.6 2.6.8l.8 6.7 3 3.2a2 2 0 0 1 .4 2.2L17.2 21M12 4.5V16M9.4 16.5 12 16l2.6.5" />,
  reply: (
    <>
      <path d="M10 8L4 13l6 5" />
      <path d="M4 13h10a6 6 0 0 1 6 6" />
    </>
  ),
  lane: (
    <>
      <path d="M5 4v16" />
      <rect x="9" y="4" width="11" height="7" rx="2.5" />
      <rect x="9" y="13" width="8" height="7" rx="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  gather: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <circle cx="5.5" cy="10" r="2.3" />
      <circle cx="18.5" cy="10" r="2.3" />
      <path d="M6 20c.5-3.3 3-5.5 6-5.5s5.5 2.2 6 5.5M1.8 18c.3-2 1.6-3.4 3.4-3.6M22.2 18c-.3-2-1.6-3.4-3.4-3.6" />
    </>
  ),
  tree: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M12 7.5V12M6 16.5V14h12v2.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  pot: (
    <>
      <path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5z" />
      <path d="M2.5 10h19M9 6.5c0-1 .8-1.2.8-2.2M12.5 6.5c0-1 .8-1.2.8-2.2" />
    </>
  ),
  care: (
    <>
      <path d="M12 20s-6.5-4-8.2-8.2C2.6 8.6 4.6 5.5 7.6 5.5c1.8 0 3.3 1 4.4 2.5 1.1-1.5 2.6-2.5 4.4-2.5 3 0 5 3.1 3.8 6.3C18.5 16 12 20 12 20z" />
      <path d="M8.5 12.5h2l1-2 1.5 4 1-2h1.5" />
    </>
  ),
  village: (
    <>
      <path d="M3 20V11l5-4 5 4v9M13 20v-6l4-3 4 3v6M2 20h20" />
      <path d="M7 20v-4h2v4" />
    </>
  ),
  sparkle: <path d="M12 3.5l1.7 5.1 5.3 1.9-5.3 1.9L12 17.5l-1.7-5.1L5 10.5l5.3-1.9L12 3.5zM18.5 15.5l.7 2 2 .8-2 .7-.7 2-.7-2-2-.7 2-.8.7-2z" />,
  door: (
    <>
      <path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V20M3.5 20h17" />
      <path d="M14.5 12.5v.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z" />,
};

export function Icon({ name, size = 22, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

/* ---------------------------------------------------------------- photo */
// next/image for bundled demo art (optimised, AVIF/WebP); plain passthrough for
// signed/session URLs that the optimiser can't fetch.
export function Photo({
  src,
  alt = "",
  sizes = "100vw",
  priority = false,
  className,
  position = "center",
}: {
  src: string;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  position?: string;
}) {
  const optimisable = src.startsWith("/demo/");
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={!optimisable}
      className={cn("object-cover", className)}
      style={{ objectPosition: position }}
    />
  );
}

/* --------------------------------------------------------------- wave */
export function Wave({
  peaks,
  progress = 0,
  bars = 34,
  height = 30,
  color = "#fff",
  dim = "rgba(255,255,255,.4)",
  className,
}: {
  peaks: number[];
  progress?: number;
  bars?: number;
  height?: number;
  color?: string;
  dim?: string;
  className?: string;
}) {
  const src = peaks.length > 0 ? peaks : new Array(bars).fill(0.45);
  const step = src.length / bars;
  return (
    <div className={cn("flex items-center gap-[2.5px]", className)} style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const v = Number(src[Math.floor(i * step)] ?? 0.4);
        return (
          <span
            key={i}
            className="block flex-1 rounded-full"
            style={{
              minWidth: 2,
              maxWidth: 3.5,
              height: `${Math.max(14, Math.round(v * 100))}%`,
              background: i / bars < progress ? color : dim,
              transition: "background var(--motion-fast)",
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- controls */
export function PlayButton({
  playing,
  onClick,
  size = 46,
  label,
  tone = "light",
}: {
  playing: boolean;
  onClick: () => void;
  size?: number;
  label: string;
  tone?: "light" | "dark";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "press grid shrink-0 place-items-center rounded-full",
        tone === "light" ? "bg-white text-black" : "bg-black text-white",
      )}
      style={{ width: size, height: size }}
    >
      <Icon name={playing ? "pause" : "play"} size={Math.round(size * 0.42)} />
    </button>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-marigold", className)}
      style={{ boxShadow: "0 0 0 3px var(--marigold-glow)" }}
    />
  );
}

export function Avatar({ src, name, size = 40, ring = false }: { src: string | null; name: string; size?: number; ring?: boolean }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-surface"
      style={{ width: size, height: size, boxShadow: ring ? "0 0 0 2px #fff, 0 0 0 3px var(--line)" : undefined }}
    >
      {src ? <Photo src={src} alt={name} sizes={`${size * 2}px`} position="center 30%" /> : <Monogram name={name} size={size} />}
    </span>
  );
}

/** Warm, stable tone per name, so a person without a photo still looks like someone. */
const TONES: [string, string][] = [
  ["#f4d7b5", "#c98a5a"],
  ["#e7d3c0", "#a7705a"],
  ["#dfe3c8", "#8c9a5f"],
  ["#d7e2e4", "#6f8f99"],
  ["#ecd2d0", "#b06f6a"],
  ["#e6dcc9", "#9c8460"],
];
export function toneFor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/** Initial in the voice serif on a soft gradient: used wherever a portrait is missing. */
export function Monogram({ name, size }: { name: string; size: number }) {
  const [light, deep] = toneFor(name || "?");
  return (
    <span
      className="voice grid h-full w-full select-none place-items-center text-white"
      style={{ background: `radial-gradient(120% 120% at 30% 20%, ${light}, ${deep})`, fontSize: Math.max(14, size * 0.44) }}
      aria-hidden="true"
    >
      {(name || "?").trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

/* ---------------------------------------------------------------- rooms */
/** Header for every room: back to the courtyard, a large title, optional subtitle. */
export function RoomHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const router = useRouter();
  return (
    <header className="mb-6">
      <div className="mb-3 flex h-11 items-center justify-between">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          aria-label="Back"
          className="press -ml-2 grid h-11 w-11 place-items-center rounded-full"
        >
          <Icon name="back" />
        </button>
        {action}
      </div>
      <h1 className="m-0 text-[32px] leading-[1.05]">{title}</h1>
      {subtitle && <p className="m-0 mt-1.5 text-[15px] text-ink-soft">{subtitle}</p>}
    </header>
  );
}

export function SectionTitle({ children, href, linkLabel }: { children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 mt-8 flex items-baseline justify-between">
      <h2 className="m-0 text-[20px]">{children}</h2>
      {href && (
        <Link href={href} className="text-[14px] font-medium text-ink-soft no-underline">
          {linkLabel ?? "See all"}
        </Link>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press flex h-[52px] items-center justify-center gap-2 rounded-full px-6 text-[16px] font-semibold disabled:opacity-40",
        variant === "primary" && "bg-black text-white",
        variant === "secondary" && "bg-surface text-ink",
        variant === "quiet" && "bg-transparent text-ink-soft",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Provenance mark for anything Muse prepared. Small, honest, never a mascot:
 * the family's words stay theirs; Muse only wrote down, translated or asked.
 */
export function MuseMark({ children = "powered by Muse", tone = "soft", className }: { children?: React.ReactNode; tone?: "soft" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-medium", tone === "light" ? "text-white/80" : "text-ink-faint", className)}>
      <Icon name="sparkle" size={13} strokeWidth={1.8} />
      {children}
    </span>
  );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-6 text-center text-[15px] text-ink-soft">{children}</p>;
}

/* -------------------------------------------------------------- actions */
export interface MenuAction {
  label: string;
  onSelect: () => void | Promise<void>;
  /** Destructive: asks once more, inside the menu ("Delete? Yes / Keep"). */
  danger?: boolean;
  confirm?: string;
}

/**
 * The "⋯" for one thing (a voice note, a recipe, a need). Opens a small
 * frosted menu; destructive actions confirm in place, never with a browser
 * dialog. Closes on outside tap or Escape.
 */
export function ActionMenu({ actions, label = "More", tone = "soft", className }: { actions: MenuAction[]; label?: string; tone?: "soft" | "light"; className?: string }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (actions.length === 0) return null;
  const run = async (a: MenuAction) => {
    setBusy(true);
    try {
      await a.onSelect();
    } finally {
      setBusy(false);
      setOpen(false);
      setConfirming(null);
    }
  };
  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn("press grid h-10 w-10 place-items-center rounded-full", tone === "light" ? "text-white" : "text-ink-soft")}
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div role="menu" className="frost absolute right-0 top-11 z-30 min-w-[200px] rounded-[18px] p-1.5" onClick={(e) => e.stopPropagation()}>
          {actions.map((a, i) =>
            confirming === i ? (
              <div key={a.label} className="px-3 py-2">
                <p className="m-0 text-[14px] text-ink">{a.confirm ?? `${a.label}?`}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void run(a)} className="press h-9 flex-1 rounded-full bg-[#b42318] text-[14px] font-semibold text-white">
                    {busy ? "…" : "Yes"}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="press h-9 flex-1 rounded-full bg-black/[.06] text-[14px] font-semibold">
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => (a.danger ? setConfirming(i) : void run(a))}
                className={cn("press flex h-11 w-full items-center rounded-[12px] px-3 text-left text-[15px] font-medium hover:bg-black/[.04]", a.danger && "text-[#b42318]")}
              >
                {a.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
