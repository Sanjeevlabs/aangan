"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  | "image";

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
      {src ? (
        <Photo src={src} alt={name} sizes={`${size * 2}px`} position="center 30%" />
      ) : (
        <span className="grid h-full w-full place-items-center text-[15px] font-semibold text-ink-soft">{name.slice(0, 1)}</span>
      )}
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

export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-6 text-center text-[15px] text-ink-soft">{children}</p>;
}
