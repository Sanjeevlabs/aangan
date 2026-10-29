import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/games/route";
import { HOME, legalTokens, myTurn, newGame, play, type Move } from "@/lib/games";
import type { Game } from "@/lib/kinds";
import { resetDemo } from "@/lib/store";
import { sessionCookie } from "./auth-helper";

const req = (member: string, body?: unknown) =>
  new Request("http://test/api/games", { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie: sessionCookie(member) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>>(r: Response | Promise<Response>) => (await (await r).json()) as T;
const T = "2026-10-29T10:00:00.000Z";
/** Deterministic dice: always the same face. */
const fixed = (v: number) => (n: number) => Math.min(v, n - 1);
const step = (g: Game, by: string, m: Move, rand = fixed(0)) => {
  const r = play(g, by, g.moves, m, T, rand);
  if (!r.ok) throw new Error(r.error);
  return r.game;
};

beforeEach(() => resetDemo());

describe("ludo", () => {
  it("needs a six to come out, moves exactly, and finishes exactly home", () => {
    expect(legalTokens([-1, -1], 5)).toEqual([]);
    expect(legalTokens([-1, 10], 6)).toEqual([0, 1]);
    expect(legalTokens([HOME - 2, -1], 3)).toEqual([]);
    let g = newGame("ludo", ["dada", "leo"], "leo", T, "g3");
    g = step(g, "dada", { roll: true }, fixed(2));
    expect(g.turn).toBe(1);
    expect(g.lastMove?.text).toBe("rolled a 3, no move");
    expect(g.state.lastRoll).toBe(3);
    g = step(g, "leo", { roll: true }, fixed(5));
    expect(g.state.dice).toBe(6);
    expect(play(g, "leo", g.moves, { roll: true }, T, fixed(5))).toEqual({ ok: false, error: "move-first" });
    g = step(g, "leo", { token: 0 });
    expect(g.state.tokens[1]).toEqual([0, -1]);
    expect(g.turn).toBe(1); // a six rolls again
  });

  it("sends a piece home on an ordinary square, never on a star", () => {
    let g = newGame("ludo", ["dada", "leo"], "leo", T, "g4");
    // Dada at track square 30; Leo starts at 26, so progress 2 is square 28.
    g = { ...g, state: { ...g.state, tokens: [[30, -1], [2, -1]] }, turn: 1 };
    g = step(g, "leo", { roll: true }, fixed(1));
    g = step(g, "leo", { token: 0 });
    expect(g.state.tokens[0]).toEqual([-1, -1]);
    expect(g.lastMove?.text).toBe("sent a piece home");
    expect(g.turn).toBe(1);
    // Square 34 is a star: no capture there.
    let s = newGame("ludo", ["dada", "leo"], "leo", T, "g5");
    s = { ...s, state: { ...s.state, tokens: [[34, -1], [5, -1]] }, turn: 1 };
    s = step(s, "leo", { roll: true }, fixed(2));
    s = step(s, "leo", { token: 0 });
    expect(s.state.tokens[0]).toEqual([34, -1]);
  });

  it("refuses moves out of turn or on a stale board", () => {
    const g = newGame("ludo", ["dada", "leo"], "leo", T, "g6");
    expect(play(g, "leo", 0, { roll: true }, T, fixed(0))).toEqual({ ok: false, error: "not-your-turn" });
    expect(play(g, "dada", 5, { roll: true }, T, fixed(0))).toEqual({ ok: false, error: "stale" });
  });
});

describe("games API", () => {
  it("starts and plays; only the player whose turn it is may move", async () => {
    const started = await json<{ game: Game }>(POST(req("leo", { action: "new", game: "ludo", players: ["leo", "dada"] })));
    const g = started.game;
    expect(g.state.tokens).toEqual([[-1, -1], [-1, -1]]);
    expect((await POST(req("dada", { action: "move", gameId: g.id, v: 0, move: { roll: true } }))).status).toBe(400);
    const moved = await json<{ game: Game }>(POST(req("leo", { action: "move", gameId: g.id, v: 0, move: { roll: true } })));
    expect(moved.game.moves).toBe(1);
    expect((await POST(req("leo", { action: "move", gameId: g.id, v: 0, move: { roll: true } }))).status).toBe(409);
  });

  it("refuses strangers, bad player counts, games you're not in, and other game kinds", async () => {
    expect((await POST(req("leo", { action: "new", game: "ludo", players: ["leo", "stranger"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "new", game: "ludo", players: ["leo", "dada", "dadi", "aria", "arjun"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "new", game: "ludo", players: ["dada", "dadi"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "new", game: "tictactoe", players: ["leo", "dada"] }))).status).toBe(400);
    expect((await POST(req("leo", { action: "move", gameId: "game-ludo-dada-leo", v: 0, move: { cell: 1 } }))).status).toBe(400);
    expect((await GET(new Request("http://test/api/games"))).status).toBe(401);
  });

  it("seeds a game where it's Leo's move", async () => {
    const list = await json<{ games: Game[] }>(GET(req("leo")));
    expect(myTurn(list.games, "leo").map((g) => g.game)).toContain("ludo");
  });
});
