import { mockPutBlob } from "@/lib/storage";

// Mock-mode upload target: the client PUTs bytes here when Supabase is
// unavailable. Live traffic goes straight to the signed bucket URL instead.
export async function PUT(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  const mime = searchParams.get("mime") || "application/octet-stream";
  if (!path) return Response.json({ error: "missing-path" }, { status: 400 });
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) return Response.json({ error: "empty-upload" }, { status: 400 });
  if (buf.byteLength > 25 * 1024 * 1024) return Response.json({ error: "media-too-large" }, { status: 413 });
  mockPutBlob(path, new Uint8Array(buf), mime);
  return Response.json({ ok: true, path });
}
