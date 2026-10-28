import { mockGetBlob } from "@/lib/storage";

// Mock-mode byte server. Live traffic is redirected to signed bucket URLs
// by /api/media/[...path] instead.
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  const blob = path ? mockGetBlob(path) : undefined;
  if (!path || !blob) return Response.json({ error: "unknown-media" }, { status: 404 });
  return new Response(blob.bytes as unknown as BodyInit, {
    headers: { "content-type": blob.mime, "cache-control": "private, max-age=300" },
  });
}
