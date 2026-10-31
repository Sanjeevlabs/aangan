import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { isMockMode, providerKey } from "@/lib/config";
import { listDocs, newId, putDoc } from "@/lib/family-docs";
import { acceptDataUrl, museImage } from "@/lib/muse-image";
import { quotaLeft, RESTORE_PROMPT } from "@/lib/muse-portrait";

// Restore an old photo (Muse Image edit of the one photo the person just
// picked). The original is never replaced: the screen shows both and the
// person keeps one. POST → { runId, image } or { runId, sample: true }.

const Body = z.object({
  image: z.string().min(32).max(9_000_000),
  /** Wide, tall or square, from the photo's own shape. */
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
  variant: z.number().int().min(0).max(20).default(0),
});

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "invalid-restore" }, { status: 400 });
  const image = acceptDataUrl(parsed.data.image);
  if (!image) return Response.json({ error: "invalid-image" }, { status: 400 });

  const runs = await listDocs(auth.familyId, "muse_image_run");
  if (quotaLeft(runs, "restore") <= 0) return Response.json({ error: "daily-limit" }, { status: 429 });
  const run = { id: newId("restore"), kind: "restore" as const, by: auth.memberId, people: [], style: "", keptCardId: null, at: new Date().toISOString() };

  if (isMockMode() || !providerKey("meta")) {
    await putDoc(auth.familyId, "muse_image_run", { ...run, sample: true });
    return Response.json({ runId: run.id, sample: true });
  }
  const out = await museImage({ familyId: auth.familyId, purpose: "Restored an old photo", prompt: RESTORE_PROMPT, images: [image], size: parsed.data.size, variant: parsed.data.variant });
  if (out.status === "refused") return Response.json({ error: "spend-cap" }, { status: 503 });
  if (out.status !== "ok") return Response.json({ error: "muse-failed" }, { status: 502 });
  await putDoc(auth.familyId, "muse_image_run", { ...run, sample: false });
  return Response.json({ runId: run.id, image: out.image });
}
