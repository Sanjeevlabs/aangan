import { TranslateRequestSchema } from "@/lib/schemas";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { translateText } from "@/lib/llm";
import { checkRateLimit, requireSession } from "@/lib/auth";

export async function POST(req: Request): Promise<Response> {
  const auth = requireSession(req);
  if (auth instanceof Response) return auth;
  if (!checkRateLimit(auth, "/api/translate")) return Response.json({ error: "rate-limited" }, { status: 429 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid-json" }, { status: 400 });
  }
  const parsed = TranslateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid-translate" }, { status: 400 });
  }
  // Cache key inside translateText is per text + target lang.
  const { translation, cached, cost } = await translateText(parsed.data.text, parsed.data.targetLang, {
    store: serverStore,
    ledger: serverLedger,
  });
  return Response.json({ translation, cached, cost });
}
