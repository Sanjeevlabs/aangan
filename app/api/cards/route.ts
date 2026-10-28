import { z } from "zod";
import { CreateCardRequestSchema } from "@/lib/schemas";
import { resolveTakenAt } from "@/lib/dating";
import { captionCard, sha256Hex } from "@/lib/llm";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { dbAddCard, dbListCards } from "@/lib/db";

export async function GET(): Promise<Response> {
  return Response.json({ cards: await dbListCards() });
}

const MultipartFieldsSchema = z.object({
  type: z.enum(["photo", "audio", "video"]),
  caption: z.string().max(280).default(""),
  lang: z.string().min(2).max(8).default("en"),
  takenAt: z.string().datetime(),
  source: z.enum(["upload", "today", "glasses", "ritual", "agent"]).default("upload"),
  peaks: z.string().default("[]"),
  palette: z.string().default("[]"),
  transcript: z.string().max(2000).default(""),
  transcriptLang: z.string().min(2).max(8).default("en"),
  segments: z.string().default("[]"),
  taggedNames: z.string().default("[]"),
});

function parseJsonArray(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseNames(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return v.filter((n): n is string => typeof n === "string").slice(0, 20);
  } catch {
    // Fall through to comma-separated.
  }
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 20);
}

// Multipart card upload: the `media` file carries the real bytes; `frames`
// carry video key frames. Photos/video with an empty caption are grounded by
// Muse Spark vision (sees the bytes) and dated EXIF/file first; uploader-
// supplied names are the ONLY names a caption may contain (grounding subset).
async function postMultipart(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid-multipart" }, { status: 400 });
  }
  const fields = MultipartFieldsSchema.safeParse({
    type: form.get("type") ?? undefined,
    caption: form.get("caption") ?? undefined,
    lang: form.get("lang") ?? undefined,
    takenAt: form.get("takenAt") ?? undefined,
    source: form.get("source") ?? undefined,
    peaks: form.get("peaks") ?? undefined,
    palette: form.get("palette") ?? undefined,
    transcript: form.get("transcript") ?? undefined,
    transcriptLang: form.get("transcriptLang") ?? undefined,
    segments: form.get("segments") ?? undefined,
    taggedNames: form.get("taggedNames") ?? undefined,
  });
  if (!fields.success) {
    return Response.json({ error: "invalid-card" }, { status: 400 });
  }
  const f = fields.data;
  const mediaEntry = form.get("media");
  const mediaFile = mediaEntry instanceof File && mediaEntry.size > 0 ? mediaEntry : null;
  const mediaBytes = mediaFile ? new Uint8Array(await mediaFile.arrayBuffer()) : null;
  if (mediaBytes && mediaBytes.length > 25 * 1024 * 1024) {
    return Response.json({ error: "media-too-large" }, { status: 413 });
  }
  const frames = form.getAll("frames").filter((x): x is File => x instanceof File && x.size > 0).slice(0, 3);
  const frameImages = await Promise.all(
    frames.map(async (blob) => ({ bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || "image/jpeg" })),
  );
  const taggedNames = parseNames(f.taggedNames);

  let caption = f.caption;
  let lang = f.lang;
  let takenAt = f.takenAt;
  // Vision grounding needs the bytes; without media there is no model call.
  if ((f.type === "photo" || f.type === "video") && !caption.trim() && mediaBytes) {
    const images =
      f.type === "video" && frameImages.length > 0
        ? frameImages
        : [{ bytes: mediaBytes, mime: mediaFile && mediaFile.type ? mediaFile.type : "image/jpeg" }];
    const prompt = `A short family video moment. Tagged: ${taggedNames.join(", ") || "none"}.`;
    const { caption: grounded } = await captionCard(prompt, {
      mediaId: sha256Hex(mediaBytes),
      store: serverStore,
      ledger: serverLedger,
      images,
    });
    // The vision prompt above constrains names to the uploader's list (the
    // only names the model may repeat); the card stores the grounded text.
    caption = grounded.caption;
    lang = grounded.language;
    takenAt = resolveTakenAt({ modelDate: grounded.takenAt });
  }
  const peaks = parseJsonArray(f.peaks).filter((n): n is number => typeof n === "number");
  const palette = parseJsonArray(f.palette).filter((n): n is string => typeof n === "string");
  const segments = parseJsonArray(f.segments);
  const card = await dbAddCard({
    familyId: "demo-family",
    type: f.type,
    caption,
    summary: "",
    lang,
    takenAt,
    ritualSlug: null,
    source: f.source,
    mediaRef: null,
    peaks: peaks.slice(0, 128),
    palette: palette.slice(0, 5),
    transcript: f.transcript.slice(0, 2000),
    transcriptLang: f.transcriptLang,
    segments: segments.slice(0, 64) as { start: number; end: number; text: string }[],
  });
  return Response.json({ card }, { status: 201 });
}

export async function POST(req: Request): Promise<Response> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) return postMultipart(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = CreateCardRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-card" }, { status: 400 });
  }
  // JSON path: client-supplied caption only — NEVER a model call. An empty
  // caption stays empty (the UI renders its untitled state); video cards that
  // need grounding must use the multipart upload with real bytes.
  const data = { ...parsed.data };
  const card = await dbAddCard({
    id: crypto.randomUUID(),
    familyId: "demo-family",
    summary: "",
    ritualSlug: null,
    ...data,
  });
  return Response.json({ card }, { status: 201 });
}
