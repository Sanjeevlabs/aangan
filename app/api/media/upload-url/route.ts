import { z } from "zod";
import { createUploadUrl, storagePath } from "@/lib/storage";
import { requireSession } from "@/lib/auth";

const BodySchema = z.object({
  filename: z.string().min(1).max(120),
  mime: z.string().min(3).max(100),
  familyId: z.string().min(1).max(64).default("demo-family"),
});

// Server-issued signed upload URL: the client PUTs bytes straight to the
// private bucket (or to the mock endpoint when Supabase is unavailable).
export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-upload-url" }, { status: 400 });
  }
  if (parsed.data.familyId !== auth.familyId) return Response.json({ error: "forbidden-family" }, { status: 403 });
  const path = storagePath(parsed.data.familyId, parsed.data.filename);
  const { uploadUrl, mock } = await createUploadUrl(path, parsed.data.mime);
  return Response.json({ path, uploadUrl, mock, ref: `storage:${path}` });
}
