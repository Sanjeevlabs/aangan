import type { GAME_KINDS } from "./kind-values";
import type { Game, GameState } from "./kinds";

// Three games a family can play across homes, one move at a time. The server
// holds the truth: it rolls the dice, shuffles the deck and checks every move,
// so no browser can peek at a card or pick its own roll. Randomness is passed
// in (crypto.randomInt on the server), so this file stays safe for the browser.

export type GameKind = (typeof GAME_KINDS)[number];
export type Move = { cell: number } | { card: number } | { roll: true } | { token: number };
export type Outcome = { ok: true; game: Game } | { ok: false; error: string };

export const GAME_LOOK: Record<GameKind, { title: string; note: string; players: [number, number] }> = {
  ludo: { title: "Ludo", note: "Quick Ludo, two pieces each. Roll a six to start.", players: [2, 4] },
  tictactoe: { title: "Tic-tac-toe", note: "Three in a row. Perfect for a grandchild and a grandparent.", players: [2, 2] },
  memory: { title: "Match the family", note: "Find the pairs. Every card is someone in your family.", players: [2, 4] },
};

/* ------------------------------------------------------------ helpers */

const empty = (): GameState => ({ board: [], deck: [], matched: [], flipped: [], shown: [], scores: [], tokens: [], dice: null });

function shuffle<T>(xs: T[], rand: (n: number) => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SYMBOLS = ["sun", "moon", "pot", "heart", "tree", "lane"];

/**
 * A new game. `faces` are member ids with a portrait (memory uses them as
 * card faces; symbols fill the rest). `rand(n)` returns 0..n-1; tests inject it.
 */
export function newGame(kind: GameKind, players: string[], by: string, now: string, id: string, faces: string[], rand: (n: number) => number): Game {
  const state = empty();
  if (kind === "tictactoe") state.board = new Array(9).fill(-1);
  if (kind === "memory") {
    const people = shuffle(faces, rand).slice(0, 6).map((f) => `m:${f}`);
    const pick = [...people, ...SYMBOLS.map((s) => `s:${s}`)].slice(0, 6);
    state.deck = shuffle([...pick, ...pick], rand);
    state.scores = players.map(() => 0);
  }
  if (kind === "ludo") state.tokens = players.map(() => [-1, -1]);
  return { id, game: kind, players, turn: 0, moves: 0, status: "playing", winner: null, state, lastMove: null, createdBy: by, createdAt: now, updatedAt: now };
}

export function validPlayers(kind: GameKind, players: string[]): boolean {
  const [min, max] = GAME_LOOK[kind].players;
  return players.length >= min && players.length <= max && new Set(players).size === players.length;
}

/** What a browser may see: memory faces only once they are turned over. */
export function masked(g: Game): Game {
  if (g.game !== "memory") return g;
  const open = new Set([...g.state.matched, ...g.state.flipped, ...g.state.shown]);
  return { ...g, state: { ...g.state, deck: g.state.deck.map((f, i) => (open.has(i) || g.status === "done" ? f : "")) } };
}

/* -------------------------------------------------------- tic-tac-toe */

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function tictactoe(g: Game, m: Move): Outcome | { game: Game; text: string } {
  if (!("cell" in m) || m.cell < 0 || m.cell > 8) return { ok: false, error: "bad-move" };
  if (g.state.board[m.cell] !== -1) return { ok: false, error: "taken" };
  const board = [...g.state.board];
  board[m.cell] = g.turn;
  const won = LINES.some((l) => l.every((i) => board[i] === g.turn));
  const full = board.every((c) => c !== -1);
  const next = { ...g, state: { ...g.state, board } };
  if (won) return { game: { ...next, status: "done", winner: g.players[g.turn] }, text: "won the game" };
  if (full) return { game: { ...next, status: "done" }, text: "made it a draw" };
  return { game: { ...next, turn: (g.turn + 1) % 2 }, text: "played" };
}

/* ------------------------------------------------------------- memory */

function memory(g: Game, m: Move): Outcome | { game: Game; text: string } {
  const s = g.state;
  if (!("card" in m) || m.card < 0 || m.card >= s.deck.length) return { ok: false, error: "bad-move" };
  if (s.matched.includes(m.card) || s.flipped.includes(m.card)) return { ok: false, error: "already-open" };
  const flipped = [...s.flipped, m.card];
  if (flipped.length === 1) return { game: { ...g, state: { ...s, flipped, shown: [] } }, text: "turned a card" };
  const [a, b] = flipped;
  if (s.deck[a] === s.deck[b]) {
    const matched = [...s.matched, a, b];
    const scores = s.scores.map((x, i) => (i === g.turn ? x + 1 : x));
    const next = { ...g, state: { ...s, matched, scores, flipped: [], shown: [] } };
    if (matched.length === s.deck.length) {
      const best = Math.max(...scores);
      const leaders = scores.flatMap((x, i) => (x === best ? [i] : []));
      return { game: { ...next, status: "done", winner: leaders.length === 1 ? g.players[leaders[0]] : null }, text: "found the last pair" };
    }
    return { game: next, text: "found a pair" };
  }
  return { game: { ...g, turn: (g.turn + 1) % g.players.length, state: { ...s, flipped: [], shown: [a, b] } }, text: "missed a pair" };
}

/* --------------------------------------------------------------- ludo */

// A round board: 52 squares on the ring, then 5 steps up your own path to the
// centre. Progress 0-50 is the ring (from your start), 51-55 your path, 56 home.
export const RING = 52;
export const HOME = 56;
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Where each player starts on the ring: opposite each other for two. */
export function seats(n: number): number[] {
  return n === 2 ? [0, 26] : n === 3 ? [0, 13, 26] : [0, 13, 26, 39];
}

/** The ring square a piece stands on, from its player's start square; null off the ring. */
export function ringSquare(start: number, progress: number): number | null {
  return progress >= 0 && progress <= 50 ? (start + progress) % RING : null;
}

export const isSafe = (square: number): boolean => SAFE.has(square);

export function legalTokens(tokens: number[], dice: number): number[] {
  return tokens.flatMap((p, i) => ((p === -1 && dice === 6) || (p >= 0 && p + dice <= HOME) ? [i] : []));
}

function ludo(g: Game, m: Move, rand: (n: number) => number): Outcome | { game: Game; text: string } {
  const s = g.state;
  const n = g.players.length;
  const next = (extra: boolean) => (extra ? g.turn : (g.turn + 1) % n);
  if ("roll" in m) {
    if (s.dice !== null) return { ok: false, error: "move-first" };
    const dice = rand(6) + 1;
    const legal = legalTokens(s.tokens[g.turn], dice);
    if (legal.length === 0) return { game: { ...g, turn: next(false), state: { ...s, dice: null } }, text: `rolled a ${dice}, no move` };
    return { game: { ...g, state: { ...s, dice } }, text: `rolled a ${dice}` };
  }
  if (!("token" in m)) return { ok: false, error: "bad-move" };
  if (s.dice === null) return { ok: false, error: "roll-first" };
  const dice = s.dice;
  if (!legalTokens(s.tokens[g.turn], dice).includes(m.token)) return { ok: false, error: "illegal" };
  const tokens = s.tokens.map((t) => [...t]);
  const from = tokens[g.turn][m.token];
  const to = from === -1 ? 0 : from + dice;
  tokens[g.turn][m.token] = to;
  const seat = seats(n)[g.turn];
  let captured = false;
  if (to <= 50) {
    const sq = (seat + to) % RING;
    if (!SAFE.has(sq)) {
      tokens.forEach((t, p) => {
        if (p === g.turn) return;
        t.forEach((q, k) => {
          if (q >= 0 && q <= 50 && (seats(n)[p] + q) % RING === sq) {
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
  const text = captured ? "sent a piece back to base" : home ? "brought a piece home" : from === -1 ? "brought a piece out" : `moved ${dice}`;
  return { game: { ...g, state, turn: next(dice === 6 || captured || home) }, text };
}

/* --------------------------------------------------------------- play */

/** Apply one move by `by`. `v` is the move count the player saw. */
export function play(g: Game, by: string, v: number, m: Move, now: string, rand: (n: number) => number): Outcome {
  if (g.status !== "playing") return { ok: false, error: "finished" };
  if (v !== g.moves) return { ok: false, error: "stale" };
  if (g.players[g.turn] !== by) return { ok: false, error: "not-your-turn" };
  const r = g.game === "tictactoe" ? tictactoe(g, m) : g.game === "memory" ? memory(g, m) : ludo(g, m, rand);
  if ("ok" in r) return r;
  return { ok: true, game: { ...r.game, moves: g.moves + 1, updatedAt: now, lastMove: { by, text: r.text, at: now } } };
}

/** Whose turn it is for this viewer, across the family's open games. */
export function myTurn(games: Game[], viewerId: string): Game[] {
  return games.filter((g) => g.status === "playing" && g.players[g.turn] === viewerId);
}
