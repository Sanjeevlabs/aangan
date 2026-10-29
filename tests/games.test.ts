import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/games/route";
import { HOME, legalTokens, masked, myTurn, newGame, play, type Move } from "@/lib/games";
import type { Game } from "@/lib/kinds";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (member: string, body?: unknown) =>
  new Request("http://test/api/games", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;
const T = "2026-10-29T10:00:00.000Z";
/** Deterministic "random": always the same index, so shuffles are the identity and dice are fixed. */
const fixed = (v: number) => (n: number) => Math.min(v, n - 1);
const step = (g: Game, by: string, m: Move, rand = fixed(0)) => {
  const r = play(g, by, g.moves, m, T, rand);
  if (!r.ok) throw new Error(r.error);
  return r.game;
};

beforeEach(() => resetDemo());

describe("tic-tac-toe", () => {
  it("alternates turns, refuses taken squares and finds a winner", () => {
    let g = newGame("tictactoe", ["leo", "dadi"], "leo", T, "g1", [], fixed(0));
    g = step(g, "leo", { cell: 0 });
    expect(play(g, "leo", g.moves, { cell: 1 }, T, fixed(0))).toEqual({ ok: false, error: "not-your-turn" });
    expect(play(g, "dadi", g.moves, { cell: 0 }, T, fixed(0))).toEqual({ ok: false, error: "taken" });
    g = step(g, "dadi", { cell: 3 });
    g = step(g, "leo", { cell: 1 });
    g = step(g, "dadi", { cell: 4 });
    g = step(g, "leo", { cell: 2 });
    expect(g.status).toBe("done");
    expect(g.winner).toBe("leo");
    expect(g.lastMove?.text).toBe("won the game");
  });

  it("refuses a move made on a stale board", () => {
    const g = newGame("tictactoe", ["leo", "dadi"], "leo", T, "g1", [], fixed(0));
    expect(play(g, "leo", 5, { cell: 0 }, T, fixed(0))).toEqual({ ok: false, error: "stale" });
  });
});

describe("memory", () => {
  it("uses family faces, keeps the deck secret and scores pairs", () => {
    let g = newGame("memory", ["leo", "aria"], "leo", T, "g2", ["dadi", "dada"], fixed(0));
    expect(g.state.deck).toHaveLength(12);
    expect(g.state.deck.filter((f) => f.startsWith("m:"))).toHaveLength(4);
    expect(masked(g).state.deck.every((f) => f === "")).toBe(true);
    const a = 0;
    const b = g.state.deck.indexOf(g.state.deck[0], 1);
    const miss = g.state.deck.findIndex((f, i) => i > 0 && f !== g.state.deck[0]);
    g = step(g, "leo", { card: a });
    expect(masked(g).state.deck[a]).not.toBe("");
    g = step(g, "leo", { card: miss });
    expect(g.turn).toBe(1);
    expect(g.state.shown).toEqual([a, miss]);
    g = step(g, "aria", { card: a });
    g = step(g, "aria", { card: b });
    expect(g.state.scores).toEqual([0, 1]);
    expect(g.turn).toBe(1);
    expect(play(g, "aria", g.moves, { card: a }, T, fixed(0))).toEqual({ ok: false, error: "already-open" });
  });
});

describe("ludo", () => {
  it("needs a six to start, moves exactly, and finishes exactly home", () => {
    expect(legalTokens([-1, -1], 5)).toEqual([]);
    expect(legalTokens([-1, 10], 6)).toEqual([0, 1]);
    expect(legalTokens([HOME - 2, -1], 3)).toEqual([]);
    let g = newGame("ludo", ["dada", "leo"], "leo", T, "g3", [], fixed(0));
    g = step(g, "dada", { roll: true }, fixed(2));
    expect(g.turn).toBe(1);
    expect(g.lastMove?.text).toBe("rolled a 3, no move");
    g = step(g, "leo", { roll: true }, fixed(5));
    expect(g.state.dice).toBe(6);
    expect(play(g, "leo", g.moves, { roll: true }, T, fixed(5))).toEqual({ ok: false, error: "move-first" });
    g = step(g, "leo", { token: 0 });
    expect(g.state.tokens[1]).toEqual([0, -1]);
    expect(g.turn).toBe(1);
  });

  it("captures on an unsafe square and sends the piece back", () => {
    let g = newGame("ludo", ["dada", "leo"], "leo", T, "g4", [], fixed(0));
    // Dada at ring square 30 (progress 30); Leo starts at 26, progress 2 = square 28.
    g = { ...g, state: { ...g.state, tokens: [[30, -1], [2, -1]] }, turn: 1 };
    g = step(g, "leo", { roll: true }, fixed(1));
    g = step(g, "leo", { token: 0 });
    expect(g.state.tokens[0]).toEqual([-1, -1]);
    expect(g.lastMove?.text).toBe("sent a piece back to base");
    expect(g.turn).toBe(1);
  });
});

describe("games API", () => {
  it("starts, plays and lists games; only the player whose turn it is may move", async () => {
    const started = await json<{ game: Game }>(POST(req("leo", { action: "new", game: "tictactoe", players: ["leo", "dada"] })));
    const g = started.game;
    expect((await POST(req("dada", { action: "move", gameId: g.id, v: 0, move: { cell: 4 } }))).status).toBe(400);
    const moved = await json<{ game: Game }>(POST(req("leo", { action: "move", gameId: g.id, v: 0, move: { cell: 4 } })));
    expect(moved.game.state.board[4]).toBe(0);
    expect((await POST(req("dada", { action: "move", gameId: g.id, v: 0, move: { cell: 1 } }))).status).toBe(409);
    const list = await json<{ games: Game[] }>(GET(req("dada")));
    expect(myTurn(list.games, "dada").map((x) => x.id)).toContain(g.id);
  });

  it("never sends a hidden memory card to the browser", async () => {
    const started = await json<{ game: Game }>(POST(req("aria", { action: "new", game: "memory", players: ["aria", "leo"] })));
    expect(started.game.state.deck.every((f) => f === "")).toBe(true);
    const list = await json<{ games: Game[] }>(GET(req("leo")));
    expect(list.games.find((x) => x.id === started.game.id)?.state.deck.every((f) => f === "")).toBe(true);
  });

  it("refuses strangers, bad player counts and games you're not in", async () => {
    expect((await POST(req("leo", { action: "new", game: "tictactoe", players: ["leo", "stranger"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "new", game: "tictactoe", players: ["leo", "dada", "dadi"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "new", game: "ludo", players: ["dada", "dadi"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "move", gameId: "game-ludo-dada-leo", v: 0, move: { cell: 1, card: 2 } }))).status).toBe(400);
    expect((await GET(new Request("http://test/api/games"))).status).toBe(401);
  });

  it("seeds a game where it's Leo's move", async () => {
    const list = await json<{ games: Game[] }>(GET(req("leo")));
    expect(myTurn(list.games, "leo").map((g) => g.game)).toContain("ludo");
  });
});
