"use client";

import { m } from "framer-motion";
import { HOME, PIECES, isSafe, legalTokens, ringSquare, seats } from "@/lib/games";
import type { Game } from "@/lib/kinds";
import type { Member } from "@/lib/schemas";
import { callName, memberPhoto } from "@/lib/people";
import { Avatar } from "./ui/kit";

// The classic Ludo board everyone recognises (SPEC §28): a 15 × 15 cross,
// four coloured yards, a 52-square track with star squares, coloured paths
// home to the centre triangle. Each yard carries its player's face.

/** Clockwise from the top-left yard. A player's colour follows their seat. */
export const SEAT_COLOURS = ["#d64545", "#2f9e5b", "#e3a412", "#2f6fd1"];
const SEAT_TINT = ["#fbe4e2", "#e1f3e7", "#fdf0cf", "#e1ebfa"];

const CELL = 24;
const SIZE = CELL * 15;

// The 52 track squares as [col, row], starting at the top-left player's start
// (just under their yard) and going clockwise.
const TRACK: [number, number][] = [
  ...[1, 2, 3, 4, 5].map((c) => [c, 6] as [number, number]),
  ...[5, 4, 3, 2, 1, 0].map((r) => [6, r] as [number, number]),
  [7, 0],
  [8, 0],
  ...[1, 2, 3, 4, 5].map((r) => [8, r] as [number, number]),
  ...[9, 10, 11, 12, 13, 14].map((c) => [c, 6] as [number, number]),
  [14, 7],
  [14, 8],
  ...[13, 12, 11, 10, 9].map((c) => [c, 8] as [number, number]),
  ...[9, 10, 11, 12, 13, 14].map((r) => [8, r] as [number, number]),
  [7, 14],
  [6, 14],
  ...[13, 12, 11, 10, 9].map((r) => [6, r] as [number, number]),
  ...[5, 4, 3, 2, 1, 0].map((c) => [c, 8] as [number, number]),
  [0, 7],
  [0, 6],
];

// Each start square's home path (5 squares) toward the centre, by track start.
const HOME_PATH: Record<number, [number, number][]> = {
  0: [1, 2, 3, 4, 5].map((c) => [c, 7]),
  13: [1, 2, 3, 4, 5].map((r) => [7, r]),
  26: [13, 12, 11, 10, 9].map((c) => [c, 7]),
  39: [13, 12, 11, 10, 9].map((r) => [7, r]),
};
// Yards (top-left corner cell) by track start: the start square sits beside its yard.
const YARD: Record<number, [number, number]> = { 0: [0, 0], 13: [9, 0], 26: [9, 9], 39: [0, 9] };
const SEAT_INDEX: Record<number, number> = { 0: 0, 13: 1, 26: 2, 39: 3 };

const centreOf = ([c, r]: [number, number]) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });

function piecePos(start: number, p: number, k: number): { x: number; y: number } {
  if (p === -1) {
    // Waiting in the yard: side by side in its white square.
    const [yc, yr] = YARD[start];
    return { x: (yc + (k === 0 ? 2 : 4)) * CELL, y: (yr + 3) * CELL };
  }
  if (p === HOME) {
    const toward = centreOf(HOME_PATH[start][4]);
    return { x: (toward.x + SIZE / 2) / 2 + (k ? 5 : -5), y: (toward.y + SIZE / 2) / 2 + (k ? 5 : -5) };
  }
  const sq = ringSquare(start, p);
  if (sq !== null) return centreOf(TRACK[sq]);
  return centreOf(HOME_PATH[start][p - 51]);
}

function Star({ x, y, fill }: { x: number; y: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 3.6 : 8;
    return `${x + r * Math.cos(a)},${y + r * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} />;
}

export function LudoBoard({ game, viewerSeat, onToken }: { game: Game; viewerSeat: number; onToken: (k: number) => void }) {
  const n = game.players.length;
  const starts = seats(n);
  const dice = game.state.dice;
  const legal = dice !== null && game.turn === viewerSeat ? legalTokens(game.state.tokens[viewerSeat] ?? [], dice) : [];
  const owner = (start: number) => starts.indexOf(start);
  const colourOf = (start: number) => SEAT_COLOURS[SEAT_INDEX[start]];
  const tintOf = (start: number) => SEAT_TINT[SEAT_INDEX[start]];
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto block w-full max-w-[380px] rounded-[22px] bg-white shadow-[0_18px_40px_-24px_rgba(0,0,0,.35)] ring-1 ring-black/[.06]" role="img" aria-label="Ludo board">
      {/* Yards */}
      {[0, 13, 26, 39].map((start) => {
        const [c, r] = YARD[start];
        const seat = owner(start);
        return (
          <g key={start}>
            <rect x={c * CELL} y={r * CELL} width={CELL * 6} height={CELL * 6} fill={seat >= 0 ? colourOf(start) : "#efece6"} />
            <rect x={c * CELL + CELL * 0.75} y={r * CELL + CELL * 0.75} width={CELL * 4.5} height={CELL * 4.5} rx={14} fill="#fff" />
            {seat >= 0 &&
              Array.from({ length: PIECES }, (_, k) => {
                const p = piecePos(start, -1, k);
                return <circle key={k} cx={p.x} cy={p.y} r={CELL * 0.62} fill={tintOf(start)} stroke={colourOf(start)} strokeOpacity={0.35} />;
              })}
          </g>
        );
      })}
      {/* Track */}
      {TRACK.map(([c, r], sq) => {
        const isStart = sq % 13 === 0;
        const start = isStart ? sq : -1;
        return (
          <g key={sq}>
            <rect x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill={isStart ? colourOf(start) : "#fff"} stroke="#e4e0d8" strokeWidth={1} />
            {isSafe(sq) && !isStart && <Star x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} fill="#c9c2b4" />}
            {isStart && <Star x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} fill="rgba(255,255,255,.85)" />}
          </g>
        );
      })}
      {/* Home paths */}
      {[0, 13, 26, 39].map((start) =>
        HOME_PATH[start].map(([c, r], i) => <rect key={`${start}-${i}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill={colourOf(start)} stroke="#fff" strokeOpacity={0.6} />),
      )}
      {/* Centre */}
      {[
        [0, `${6 * CELL},${6 * CELL} ${6 * CELL},${9 * CELL} ${SIZE / 2},${SIZE / 2}`],
        [13, `${6 * CELL},${6 * CELL} ${9 * CELL},${6 * CELL} ${SIZE / 2},${SIZE / 2}`],
        [26, `${9 * CELL},${6 * CELL} ${9 * CELL},${9 * CELL} ${SIZE / 2},${SIZE / 2}`],
        [39, `${6 * CELL},${9 * CELL} ${9 * CELL},${9 * CELL} ${SIZE / 2},${SIZE / 2}`],
      ].map(([start, pts]) => (
        <polygon key={start as number} points={pts as string} fill={colourOf(start as number)} />
      ))}
      {/* Pieces */}
      {game.state.tokens.map((toks, i) =>
        toks.map((p, k) => {
          const pos = piecePos(starts[i], p, k);
          const colour = colourOf(starts[i]);
          const can = i === viewerSeat && legal.includes(k);
          return (
            <g
              key={`${i}-${k}`}
              onClick={can ? () => onToken(k) : undefined}
              style={{ cursor: can ? "pointer" : "default" }}
              role={can ? "button" : undefined}
              aria-label={can ? `Move piece ${k + 1}` : undefined}
              tabIndex={can ? 0 : undefined}
              onKeyDown={can ? (e) => (e.key === "Enter" || e.key === " ") && onToken(k) : undefined}
            >
              {can && <m.circle cx={pos.x} cy={pos.y} r={15} fill={colour} initial={{ opacity: 0.15 }} animate={{ opacity: [0.15, 0.45, 0.15] }} transition={{ duration: 1.3, repeat: Infinity }} />}
              <m.g animate={{ x: pos.x, y: pos.y }} initial={false} transition={{ type: "spring", stiffness: 260, damping: 24 }}>
                <ellipse cx={0} cy={7} rx={7.5} ry={2.6} fill="rgba(0,0,0,.18)" />
                <circle cx={0} cy={0} r={8.5} fill={colour} stroke="#fff" strokeWidth={2.6} />
                <circle cx={-2.4} cy={-2.6} r={2.2} fill="#fff" opacity={0.55} />
              </m.g>
            </g>
          );
        }),
      )}
    </svg>
  );
}

export function Dice({ value, size = 64, live = false }: { value: number | null; size?: number; live?: boolean }) {
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [
      [1, 1],
      [3, 3],
    ],
    3: [
      [1, 1],
      [2, 2],
      [3, 3],
    ],
    4: [
      [1, 1],
      [3, 1],
      [1, 3],
      [3, 3],
    ],
    5: [
      [1, 1],
      [3, 1],
      [2, 2],
      [1, 3],
      [3, 3],
    ],
    6: [
      [1, 1],
      [3, 1],
      [1, 2],
      [3, 2],
      [1, 3],
      [3, 3],
    ],
  };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-label={value ? `Dice shows ${value}` : "Dice"}>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#fff" stroke="#1d1d1f" strokeOpacity={live ? 0.5 : 0.12} strokeWidth="1.5" />
      {(value ? pips[value] : pips[6]).map(([x, y], i) => (
        <circle key={i} cx={x * 9 + 2} cy={y * 9 + 2} r="3.2" fill="#1d1d1f" opacity={value ? 1 : 0.12} />
      ))}
    </svg>
  );
}

export function GameArt({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
      <rect width="56" height="56" rx="16" fill="#fff" stroke="#e4e0d8" />
      <rect x="6" y="6" width="18" height="18" rx="4" fill={SEAT_COLOURS[0]} />
      <rect x="32" y="6" width="18" height="18" rx="4" fill={SEAT_COLOURS[1]} />
      <rect x="32" y="32" width="18" height="18" rx="4" fill={SEAT_COLOURS[2]} />
      <rect x="6" y="32" width="18" height="18" rx="4" fill={SEAT_COLOURS[3]} />
      <circle cx="28" cy="28" r="4" fill="#1d1d1f" />
    </svg>
  );
}

export function Players({ game, members, viewerId }: { game: Game; members: Member[]; viewerId: string }) {
  const starts = seats(game.players.length);
  return (
    <ul className="m-0 flex list-none justify-center gap-5 p-0">
      {game.players.map((id, i) => {
        const p = members.find((x) => x.id === id);
        const turn = game.status === "playing" && game.turn === i;
        const colour = SEAT_COLOURS[{ 0: 0, 13: 1, 26: 2, 39: 3 }[starts[i]] ?? i];
        return (
          <li key={id} className="flex flex-col items-center gap-1">
            <span className="rounded-full p-[3px]" style={{ background: turn ? colour : "transparent" }}>
              <Avatar src={memberPhoto(p)} name={callName(p)} size={48} ring />
            </span>
            <span className="flex items-center gap-1 text-[13px] font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ background: colour }} aria-hidden="true" />
              {id === viewerId ? "You" : callName(p)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
