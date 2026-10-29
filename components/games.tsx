"use client";

import { m } from "framer-motion";
import { HOME, RING, isSafe, legalTokens, ringSquare, seats, type GameKind } from "@/lib/games";
import type { Game } from "@/lib/kinds";
import type { Member } from "@/lib/schemas";
import { callName, memberPhoto } from "@/lib/people";
import { cn } from "@/lib/utils";
import { Avatar, Icon, Photo } from "./ui/kit";

// The boards. Calm, flat, no chrome: dots and lines, the family's own faces.

export const SEAT_COLOURS = ["#e39b12", "#2a8f84", "#cf5f74", "#4c5fd5"];

/* --------------------------------------------------------------- art */

export function GameArt({ kind, size = 56 }: { kind: GameKind; size?: number }) {
  return (
    <svg viewBox="0 0 56 56" width={size} height={size} aria-hidden="true">
      <rect width="56" height="56" rx="16" fill={kind === "ludo" ? "#fff2d6" : kind === "tictactoe" ? "#e7eefc" : "#fbe6ea"} />
      {kind === "ludo" && (
        <g>
          <circle cx="28" cy="28" r="16" fill="none" stroke="#e39b12" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
          {SEAT_COLOURS.map((c, i) => (
            <circle key={c} cx={28 + 16 * Math.cos((i * Math.PI) / 2 - Math.PI / 2)} cy={28 + 16 * Math.sin((i * Math.PI) / 2 - Math.PI / 2)} r="4.5" fill={c} />
          ))}
          <circle cx="28" cy="28" r="4" fill="#1d1d1f" />
        </g>
      )}
      {kind === "tictactoe" && (
        <g stroke="#2f4f8a" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M22 14v28M34 14v28M14 22h28M14 34h28" opacity=".35" />
          <path d="M16 16l4 4M20 16l-4 4" />
          <circle cx="28" cy="28" r="2.8" />
          <path d="M36 36l4 4M40 36l-4 4" />
        </g>
      )}
      {kind === "memory" && (
        <g>
          <rect x="12" y="15" width="14" height="19" rx="4" fill="#cf5f74" transform="rotate(-8 19 24)" />
          <rect x="29" y="20" width="14" height="19" rx="4" fill="#fff" stroke="#cf5f74" strokeWidth="2" transform="rotate(7 36 30)" />
          <circle cx="36" cy="28" r="3" fill="#cf5f74" />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------- tic-tac-toe */

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function TicTacToeBoard({ game, canMove, onMove }: { game: Game; canMove: boolean; onMove: (cell: number) => void }) {
  const b = game.state.board;
  const win = LINES.find((l) => b[l[0]] !== -1 && l.every((i) => b[i] === b[l[0]]));
  return (
    <div className="mx-auto grid aspect-square w-full max-w-[320px] grid-cols-3 gap-2" role="grid" aria-label="Tic-tac-toe board">
      {b.map((v, i) => (
        <button
          key={i}
          type="button"
          role="gridcell"
          disabled={!canMove || v !== -1}
          onClick={() => onMove(i)}
          aria-label={v === -1 ? `Empty square ${i + 1}` : `Square ${i + 1}: ${v === 0 ? "cross" : "nought"}`}
          className={cn("press grid place-items-center rounded-[22px] transition-colors", win?.includes(i) ? "bg-[#fff2d6]" : "bg-surface", canMove && v === -1 && "hover:bg-black/[.06]")}
        >
          {v !== -1 && (
            <m.svg viewBox="0 0 40 40" className="h-1/2 w-1/2" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }}>
              {v === 0 ? <path d="M9 9l22 22M31 9L9 31" stroke={SEAT_COLOURS[0]} strokeWidth="5" strokeLinecap="round" /> : <circle cx="20" cy="20" r="12" fill="none" stroke={SEAT_COLOURS[1]} strokeWidth="5" />}
            </m.svg>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ memory */

export function MemoryBoard({ game, members, canMove, onMove }: { game: Game; members: Member[]; canMove: boolean; onMove: (card: number) => void }) {
  const s = game.state;
  return (
    <div className="mx-auto grid w-full max-w-[360px] grid-cols-4 gap-2" role="grid" aria-label="Memory cards">
      {s.deck.map((face, i) => {
        const open = face !== "";
        const matched = s.matched.includes(i);
        const person = face.startsWith("m:") ? members.find((x) => x.id === face.slice(2)) : undefined;
        const photo = memberPhoto(person);
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            disabled={!canMove || open}
            onClick={() => onMove(i)}
            aria-label={open ? (person ? callName(person) : face.slice(2)) : `Card ${i + 1}, face down`}
            className={cn("press relative aspect-[3/4] overflow-hidden rounded-[16px]", open ? "bg-white ring-1 ring-black/[.08]" : "bg-[#cf5f74]", matched && "opacity-60")}
          >
            {!open && (
              <svg viewBox="0 0 30 40" className="absolute inset-0 h-full w-full" aria-hidden="true">
                <circle cx="15" cy="20" r="5" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.5" />
                <circle cx="15" cy="20" r="1.6" fill="#fff" fillOpacity=".8" />
              </svg>
            )}
            {open && person && photo && <Photo src={photo} alt="" sizes="96px" position="center 30%" />}
            {open && person && !photo && <span className="grid h-full place-items-center text-[22px] font-bold">{callName(person).slice(0, 1)}</span>}
            {open && !person && (
              <span className="grid h-full place-items-center text-[#cf5f74]">
                <Icon name={face.slice(2) as Parameters<typeof Icon>[0]["name"]} size={28} />
              </span>
            )}
            {open && person && <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-white/90 px-1 text-center text-[10px] font-semibold">{callName(person)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- ludo */

const C = 180;
const R = 140;
const angle = (sq: number) => -Math.PI / 2 + (sq / RING) * Math.PI * 2;
const at = (a: number, r: number) => ({ x: C + r * Math.cos(a), y: C + r * Math.sin(a) });

/** Board position of a piece, by its player's start square and progress. */
function piecePos(start: number, p: number, k: number): { x: number; y: number } {
  if (p === -1) return at(angle(start) - 0.13 + k * 0.26, R + 26);
  const sq = ringSquare(start, p);
  if (sq !== null) return at(angle(sq), R);
  const a = angle(start) - Math.PI / RING; // the path up to the centre leaves just before your start
  if (p === HOME) return at(angle(start), 10 + k * 8);
  return at(a, R - 22 * (p - 50));
}

export function LudoBoard({ game, viewerSeat, onToken }: { game: Game; viewerSeat: number; onToken: (k: number) => void }) {
  const n = game.players.length;
  const starts = seats(n);
  const dice = game.state.dice;
  const legal = dice !== null && game.turn === viewerSeat ? legalTokens(game.state.tokens[viewerSeat] ?? [], dice) : [];
  return (
    <svg viewBox="0 0 360 360" className="mx-auto block w-full max-w-[360px]" role="img" aria-label="Ludo board">
      {Array.from({ length: RING }, (_, sq) => {
        const p = at(angle(sq), R);
        const owner = starts.indexOf(sq);
        return <circle key={sq} cx={p.x} cy={p.y} r={owner >= 0 ? 8 : isSafe(sq) ? 6 : 4.2} fill={owner >= 0 ? SEAT_COLOURS[owner] : isSafe(sq) ? "#d9d2c5" : "#e9e5de"} opacity={owner >= 0 ? 0.35 : 1} />;
      })}
      {starts.map((start, i) => {
        const a = angle(start) - Math.PI / RING;
        return Array.from({ length: 5 }, (_, j) => {
          const p = at(a, R - 22 * (j + 1));
          return <circle key={`${i}-${j}`} cx={p.x} cy={p.y} r={4.2} fill={SEAT_COLOURS[i]} opacity={0.3} />;
        });
      })}
      <circle cx={C} cy={C} r={14} fill="#1d1d1f" />
      {game.state.tokens.map((toks, i) =>
        toks.map((p, k) => {
          const pos = piecePos(starts[i], p, k);
          const can = i === viewerSeat && legal.includes(k);
          return (
            <g key={`${i}-${k}`} onClick={can ? () => onToken(k) : undefined} style={{ cursor: can ? "pointer" : "default" }} role={can ? "button" : undefined} aria-label={can ? `Move piece ${k + 1}` : undefined} tabIndex={can ? 0 : undefined} onKeyDown={can ? (e) => (e.key === "Enter" || e.key === " ") && onToken(k) : undefined}>
              {can && (
                <m.circle cx={pos.x} cy={pos.y} r={17} fill={SEAT_COLOURS[i]} initial={{ opacity: 0.15 }} animate={{ opacity: [0.15, 0.4, 0.15] }} transition={{ duration: 1.4, repeat: Infinity }} />
              )}
              <m.circle animate={{ cx: pos.x, cy: pos.y }} transition={{ type: "spring", stiffness: 260, damping: 26 }} r={10} fill={SEAT_COLOURS[i]} stroke="#fff" strokeWidth={3} />
            </g>
          );
        }),
      )}
    </svg>
  );
}

export function Dice({ value, size = 64 }: { value: number | null; size?: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [3, 1], [1, 3], [3, 3]],
    5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
    6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
  };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-label={value ? `Dice shows ${value}` : "Dice"}>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="#fff" stroke="#1d1d1f" strokeOpacity=".12" strokeWidth="1.5" />
      {(value ? pips[value] : []).map(([x, y], i) => (
        <circle key={i} cx={x * 9 + 2} cy={y * 9 + 2} r="3.2" fill="#1d1d1f" />
      ))}
    </svg>
  );
}

export function Players({ game, members, viewerId }: { game: Game; members: Member[]; viewerId: string }) {
  return (
    <ul className="m-0 flex list-none justify-center gap-4 p-0">
      {game.players.map((id, i) => {
        const p = members.find((x) => x.id === id);
        const turn = game.status === "playing" && game.turn === i;
        return (
          <li key={id} className="flex flex-col items-center gap-1">
            <span className="rounded-full p-[3px]" style={{ background: turn ? SEAT_COLOURS[i] : "transparent" }}>
              <Avatar src={memberPhoto(p)} name={callName(p)} size={48} ring />
            </span>
            <span className="flex items-center gap-1 text-[13px] font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ background: SEAT_COLOURS[i] }} aria-hidden="true" />
              {id === viewerId ? "You" : callName(p)}
              {game.game === "memory" && <span className="tnum text-ink-soft">· {game.state.scores[i] ?? 0}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
