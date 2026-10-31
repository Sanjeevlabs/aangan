import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { acceptDataUrl } from "@/lib/muse-image";
import { scanRecipe } from "@/lib/recipe-scan";

// Scan a recipe card: the photo → a draft for the recipe editor. Nothing is
// saved here; the person checks it in the editor and saves from there.
// → { draft, source }   (draft null = open the editor empty, photo attached)

const Body = z.object({ image: z.string().min(32).max(9_000_000) });

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
  const dataUrl = parsed.success ? acceptDataUrl(parsed.data.image) : null;
  if (!dataUrl) return Response.json({ error: "invalid-image" }, { status: 400 });
  const [head, b64] = dataUrl.split(",");
  const mime = head.slice(5, head.indexOf(";"));
  const out = await scanRecipe({ familyId: auth.familyId, image: { bytes: new Uint8Array(Buffer.from(b64, "base64")), mime } });
  return Response.json(out);
}
