import { z } from "zod";
import { curatePlaylist } from "@/lib/llm";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { dbAddGatherSession, dbListCards, dbListGatherSessions, dbListMembers } from "@/lib/db";

export async function GET(): Promise<Response> {
  const [sessions, members] = await Promise.all([dbListGatherSessions(), dbListMembers()]);
  return Response.json({ sessions, members });
}

const CreateGatherSchema = z.object({
  title: z.string().min(1).max(120).default("Family evening"),
  startsAt: z.string().datetime(),
  invites: z.array(z.string()).max(20).default([]),
});

// Plan a Gather: date + per-member local times (client renders via Intl),
// invites, playlist curated by the model from the Lane.
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateGatherSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-gather" }, { status: 400 });
  }
  const cards = await dbListCards();
  const audio = cards.filter((c) => c.type === "audio").slice(0, 20);
  const { tracks } = await curatePlaylist(
    audio.map((c) => ({ id: c.id, caption: c.caption })),
    { store: serverStore, ledger: serverLedger },
  );
  const session = await dbAddGatherSession({
    title: parsed.data.title,
    startsAt: parsed.data.startsAt,
    invites: parsed.data.invites,
    playlist: tracks.map((t) => t.cardId),
  });
  return Response.json({ session, playlist: tracks }, { status: 201 });
}
