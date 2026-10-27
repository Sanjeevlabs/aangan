import { TranscribeRequestSchema } from "@/lib/schemas";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { transcribeVoice } from "@/lib/llm";

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = TranscribeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-transcribe" }, { status: 400 });
  }
  const { transcript, cached, cost } = await transcribeVoice(parsed.data, {
    store: serverStore,
    ledger: serverLedger,
  });
  return Response.json({ transcript, cached, cost });
}
