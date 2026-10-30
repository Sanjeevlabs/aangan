import { z } from "zod";
import { checkRateLimit, requireSession } from "@/lib/auth";
import { dbGetMember } from "@/lib/db";
import { countryForZones } from "@/lib/holidays";
import { callName } from "@/lib/people";
import { isBlockedText, rememberShown, searchCandidates } from "@/lib/partners/catalog";
import { pickSuggestions } from "@/lib/partners/suggest";

// POST {forMemberId, occasion? | need?} → three things to send, chosen by Muse
// only from what the partners' catalogues returned. Never medical, never ads.
const BodySchema = z
  .object({
    forMemberId: z.string().min(1).max(64),
    occasion: z.string().trim().min(1).max(80).optional(),
    need: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((b) => !(b.occasion && b.need), { message: "occasion-or-need" });

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/partners/suggest")) return Response.json({ error: "rate-limited" }, { status: 429 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid-request" }, { status: 400 });
  const body = parsed.data;
  const recipient = await dbGetMember(body.forMemberId);
  if (!recipient || recipient.familyId !== auth.familyId) return Response.json({ error: "unknown-member" }, { status: 404 });

  const kind = body.need ? "need" : "occasion";
  const title = body.need ?? body.occasion ?? "Just because";
  // Medicines go only through a licensed partner with a prescription (SPEC §9.1): not here.
  if (isBlockedText(title)) return Response.json({ suggestions: [], sample: false, refused: "medical" });

  const country = countryForZones([recipient.tz]);
  const found = await searchCandidates({ familyId: auth.familyId, memberId: auth.memberId, country, city: recipient.city, kind, title });
  const { suggestions, source } = await pickSuggestions({ familyId: auth.familyId, recipientName: callName(recipient), kind, title, candidates: found.candidates });
  rememberShown(auth.familyId, auth.memberId, suggestions);
  return Response.json({
    sample: found.sample,
    source,
    connectable: found.connectable,
    suggestions: suggestions.map((s) => ({
      id: s.id,
      partnerId: s.partnerId,
      via: s.via,
      kind: s.kind,
      name: s.name,
      price: s.price,
      currency: s.currency,
      image: s.image ?? null,
      why: s.why,
      sample: s.sample,
      needsAccount: s.account,
    })),
  });
}
