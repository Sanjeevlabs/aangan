import { requireSession } from "@/lib/auth";
import { dbListMembers } from "@/lib/db";
import { listDocs } from "@/lib/family-docs";
import { letterShareLink } from "@/lib/nudge-mail";
import { listFor, renderNudgeText } from "@/lib/nudges";
import { guardWrites } from "@/lib/api-guard";

// Your own list only: what is waiting for you, and what came this week.
// Names are resolved for you here; nobody else can read it.
async function getHandler(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const [nudges, members] = await Promise.all([listFor(auth.familyId, auth.memberId), dbListMembers(auth.familyId)]);
  const letters = nudges.some((n) => n.kind === "letter") ? await listDocs(auth.familyId, "chitthi") : [];
  const origin = (process.env.APP_ORIGIN || new URL(req.url).origin).replace(/\/$/, "");
  return Response.json({
    nudges: nudges.map((n) => {
      const letterId = n.kind === "letter" ? new URL(n.href, "http://x").searchParams.get("letter") : null;
      const letter = letterId ? letters.find((l) => l.id === letterId) : undefined;
      return {
        id: n.id,
        kind: n.kind,
        text: renderNudgeText(n.text, members),
        href: n.href,
        at: n.at,
        waiting: n.deliveredAt === null,
        seen: n.seenAt !== null,
        ...(letter ? { share: letterShareLink(letter.title ?? "A letter from the courtyard", origin) } : {}),
      };
    }),
  });
}

export const GET = guardWrites(getHandler);
