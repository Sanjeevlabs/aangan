import type { GAME_KINDS } from "./kind-values";
import type { Game, GameState } from "./kinds";

// Ludo, the one game (SPEC §28): what a grandchild asks to play with Dada,
// on a call or one move at a time across time zones. The server holds the
// truth: it rolls and checks every move. Randomness is passed in
// (crypto.randomInt on the server), so this file stays safe for the browser.
//
// The classic board: 52 squares around a cross, then 5 coloured squares up
// your own path to the centre. Progress 0-50 is the track from your start,
// 51-55 your home path, 56 home. Two pieces each keeps a game to one sitting.

export type GameKind = (typeof GAME_KINDS)[number];
export type Move = { roll: true } | { token: number };
export type Outcome = { ok: true; game: Game } | { ok: false; error: string };

export const GAME_LOOK: Record<GameKind, { title: string; note: string; players: [number, number] }> = {
  ludo: { title: "Ludo", note: "Two pieces each. Roll a six to come out; land on someone to send them home.", players: [2, 4] },
};

export const RING = 52;
export const HOME = 56;
export const PIECES = 2;
/** Start squares and the star squares eight steps on: nobody can be sent home there. */
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Where each player starts on the track: opposite each other for two. */
export function seats(n: number): number[] {
  return n === 2 ? [0, 26] : n === 3 ? [0, 13, 26] : [0, 13, 26, 39];
}

/** The track square a piece stands on, from its player's start; null off the track. */
export function ringSquare(start: number, progress: number): number | null {
  return progress >= 0 && progress <= 50 ? (start + progress) % RING : null;
}

export const isSafe = (square: number): boolean => SAFE.has(square);

export function legalTokens(tokens: number[], dice: number): number[] {
  return tokens.flatMap((p, i) => ((p === -1 && dice === 6) || (p >= 0 && p + dice <= HOME) ? [i] : []));
}

export function newGame(kind: GameKind, players: string[], by: string, now: string, id: string): Game {
  const state: GameState = { tokens: players.map(() => new Array(PIECES).fill(-1)), dice: null, lastRoll: null };
  return { id, game: kind, players, turn: 0, moves: 0, status: "playing", winner: null, state, lastMove: null, createdBy: by, createdAt: now, updatedAt: now };
}

export function validPlayers(kind: GameKind, players: string[]): boolean {
  const [min, max] = GAME_LOOK[kind].players;
  return players.length >= min && players.length <= max && new Set(players).size === players.length;
}

function ludo(g: Game, m: Move, rand: (n: number) => number): Outcome | { game: Game; text: string } {
  const s = g.state;
  const n = g.players.length;
  const next = (extra: boolean) => (extra ? g.turn : (g.turn + 1) % n);
  if ("roll" in m) {
    if (s.dice !== null) return { ok: false, error: "move-first" };
    const dice = rand(6) + 1;
    const legal = legalTokens(s.tokens[g.turn], dice);
    if (legal.length === 0) return { game: { ...g, turn: next(false), state: { ...s, dice: null, lastRoll: dice } }, text: `rolled a ${dice}, no move` };
    return { game: { ...g, state: { ...s, dice, lastRoll: dice } }, text: `rolled a ${dice}` };
  }
  if (s.dice === null) return { ok: false, error: "roll-first" };
  const dice = s.dice;
  if (!legalTokens(s.tokens[g.turn], dice).includes(m.token)) return { ok: false, error: "illegal" };
  const tokens = s.tokens.map((t) => [...t]);
  const from = tokens[g.turn][m.token];
  const to = from === -1 ? 0 : from + dice;
  tokens[g.turn][m.token] = to;
  const starts = seats(n);
  let captured = false;
  if (to <= 50) {
    const sq = (starts[g.turn] + to) % RING;
    if (!SAFE.has(sq)) {
      tokens.forEach((t, p) => {
        if (p === g.turn) return;
        t.forEach((q, k) => {
          if (q >= 0 && q <= 50 && (starts[p] + q) % RING === sq) {
            tokens[p][k] = -1;
            captured = true;
          }
        });
      });
    }
  }
  const state = { ...s, tokens, dice: null };
  if (tokens[g.turn].every((p) => p === HOME)) return { game: { ...g, state, status: "done", winner: g.players[g.turn] }, text: "brought every piece home and won" };
  const home = to === HOME;
  const text = captured ? "sent a piece home" : home ? "brought a piece home" : from === -1 ? "brought a piece out" : `moved ${dice}`;
  return { game: { ...g, state, turn: next(dice === 6 || captured || home) }, text };
}

/** Apply one move by `by`. `v` is the move count the player saw. */
export function play(g: Game, by: string, v: number, m: Move, now: string, rand: (n: number) => number): Outcome {
  if (g.status !== "playing") return { ok: false, error: "finished" };
  if (v !== g.moves) return { ok: false, error: "stale" };
  if (g.players[g.turn] !== by) return { ok: false, error: "not-your-turn" };
  const r = ludo(g, m, rand);
  if ("ok" in r) return r;
  return { ok: true, game: { ...r.game, moves: g.moves + 1, updatedAt: now, lastMove: { by, text: r.text, at: now } } };
}

/** Whose turn it is for this viewer, across the family's open games. */
export function myTurn(games: Game[], viewerId: string): Game[] {
  return games.filter((g) => g.status === "playing" && g.players[g.turn] === viewerId);
}
