import { createDownloadUrl } from "@/lib/storage";

// Private-bucket reads: refs shaped `storage:<path>` resolve here and are
// redirected (307) to a short-lived signed URL. Clients keep using
// resolveMediaUrl synchronously; freshness is minted per request.
export async function GET(_req: Request, { params }: { params: { path: string[] } }): Promise<Response> {
  const path = params.path.join("/");
  if (!path || path.includes("..")) return Response.json({ error: "invalid-media-path" }, { status: 400 });
  const target = await createDownloadUrl(path);
  if (!target) return Response.json({ error: "unknown-media" }, { status: 404 });
  return Response.redirect(target.url, 307);
}
