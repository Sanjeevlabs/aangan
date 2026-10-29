import { randomInt } from "crypto";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { dbGetMember, dbListMembers } from "@/lib/db";
import { deleteDoc, getDoc, listDocs, newId, putDoc } from "@/lib/family-docs";
import { newGame, play, validPlayers, type Move } from "@/lib/games";
import { GAME_KINDS } from "@/lib/kind-values";

// Ludo across homes. GET → the family's games. POST → new · move · end.
// The server rolls and referees.

const id = z.string().min(1).max(80);
const MoveSchema = z.union([z.object({ roll: z.literal(true) }).strict(), z.object({ token: z.number().int().min(0).max(3) }).strict()]);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("new"), game: z.enum(GAME_KINDS), players: z.array(id).min(2).max(4) }),
  z.object({ action: z.literal("move"), gameId: id, v: z.number().int().min(0), move: MoveSchema }),
  z.object({ action: z.literal("end"), gameId: id }),
]);

const OPEN_LIMIT = 30;

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const games = await listDocs(auth.familyId, "game");
  return Response.json({ games: games });
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid-game" }, { status: 400 });
  const body = parsed.data;
  const now = new Date().toISOString();

  if (body.action === "new") {
    const members = await dbListMembers(auth.familyId);
    if (!body.players.includes(auth.memberId)) return Response.json({ error: "join-your-own-game" }, { status: 400 });
    if (!body.players.every((p) => members.some((m) => m.id === p))) return Response.json({ error: "unknown-member" }, { status: 400 });
    if (!validPlayers(body.game, body.players)) return Response.json({ error: "wrong-player-count" }, { status: 400 });
    const open = (await listDocs(auth.familyId, "game")).filter((g) => g.status === "playing");
    if (open.length >= OPEN_LIMIT) return Response.json({ error: "too-many-games" }, { status: 429 });
    const game = await putDoc(auth.familyId, "game", newGame(body.game, body.players, auth.memberId, now, newId("game")));
    return Response.json({ game: game });
  }

  const game = await getDoc(auth.familyId, "game", body.gameId);
  if (!game) return Response.json({ error: "not-found" }, { status: 404 });

  if (body.action === "end") {
    const me = await dbGetMember(auth.memberId);
    if (!game.players.includes(auth.memberId) && me?.access !== "admin") return Response.json({ error: "forbidden" }, { status: 403 });
    await deleteDoc(auth.familyId, "game", game.id);
    return Response.json({ ok: true });
  }

  const out = play(game, auth.memberId, body.v, body.move as Move, now, randomInt);
  if (!out.ok) return Response.json({ error: out.error, game: game }, { status: out.error === "stale" ? 409 : 400 });
  const saved = await putDoc(auth.familyId, "game", out.game);
  return Response.json({ game: saved });
}
