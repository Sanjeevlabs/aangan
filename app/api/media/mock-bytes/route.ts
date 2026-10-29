import { mockGetBlob } from "@/lib/storage";
import { requireSession } from "@/lib/auth";
import { isDbLive } from "@/lib/supabase";
import { isMediaMime } from "@/lib/media-types";



// Mock-mode byte server. Live traffic is redirected to signed bucket URLs
// by /api/media/[...path] instead.
export async function GET(req: Request): Promise<Response> {
  if (isDbLive()) return Response.json({ error: "not-found" }, { status: 404 });
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (path && !path.startsWith(`${auth.familyId}/`)) return Response.json({ error: "forbidden-family" }, { status: 403 });
  const blob = path ? mockGetBlob(path) : undefined;
  if (!path || !blob || !isMediaMime(blob.mime)) return Response.json({ error: "unknown-media" }, { status: 404 });
  return new Response(blob.bytes as unknown as BodyInit, {
    headers: { "content-type": blob.mime, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" },
  });
}
