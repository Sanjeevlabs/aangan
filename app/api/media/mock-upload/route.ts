import { mockPutBlob } from "@/lib/storage";
import { requireSession } from "@/lib/auth";
import { isDbLive } from "@/lib/supabase";
import { isMediaMime } from "@/lib/media-types";



// Mock-mode upload target: the client PUTs bytes here when Supabase is
// unavailable. Live traffic goes straight to the signed bucket URL instead.
export async function PUT(req: Request): Promise<Response> {
  // Only a mock-mode seam: with a live database, uploads go to signed bucket URLs.
  if (isDbLive()) return Response.json({ error: "not-found" }, { status: 404 });
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (path && !path.startsWith(`${auth.familyId}/`)) return Response.json({ error: "forbidden-family" }, { status: 403 });
  const mime = (searchParams.get("mime") || "").toLowerCase();
  // Photos, voices and videos only: never HTML or scripts on the app's origin.
  if (!isMediaMime(mime)) return Response.json({ error: "unsupported-media" }, { status: 415 });
  if (!path) return Response.json({ error: "missing-path" }, { status: 400 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return Response.json({ error: "empty-upload" }, { status: 400 });
  if (buf.byteLength > 25 * 1024 * 1024) return Response.json({ error: "media-too-large" }, { status: 413 });
  mockPutBlob(path, new Uint8Array(buf), mime);
  return Response.json({ ok: true, path });
}
