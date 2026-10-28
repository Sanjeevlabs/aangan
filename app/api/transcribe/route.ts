import { z } from "zod";
import { normalizeDisplayLang } from "@/lib/i18n";
import { transcribeVoice } from "@/lib/llm";
import { serverLedger, serverStore } from "@/lib/llm-server";

const FieldsSchema = z.object({
  langHint: z.string().min(2).max(8).default("en"),
  keywords: z.string().max(500).default(""),
});

// Voice transcription from the RECORDED bytes (06_muse_voice/01): multipart
// `audio` (WAV) + fields. Cache key = sha256 of the bytes. Failures return
// "Transcript unavailable" — never a model-written transcript.
export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid-multipart" }, { status: 400 });
  }
  const audio = form.get("audio");
  const parsed = FieldsSchema.safeParse({
    langHint: form.get("langHint") ?? undefined,
    keywords: form.get("keywords") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid-transcribe" }, { status: 400 });
  }
  if (!(audio instanceof Blob) || audio.size === 0) {
    return Response.json({ error: "missing-audio" }, { status: 400 });
  }
  if (audio.size > 32 * 1024 * 1024) {
    return Response.json({ error: "audio-too-large" }, { status: 413 });
  }
  const audioBytes = new Uint8Array(await audio.arrayBuffer());
  const langHint = normalizeDisplayLang(parsed.data.langHint);
  const keywords = parsed.data.keywords ? parsed.data.keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10) : undefined;
  const { transcript, cached, cost, unavailable } = await transcribeVoice(
    { audioBytes, langHint, keywords },
    { store: serverStore, ledger: serverLedger },
  );
  return Response.json({ transcript, cached, cost, unavailable });
}
