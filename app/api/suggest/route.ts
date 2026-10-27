import { z } from "zod";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { normalizeDisplayLang } from "@/lib/i18n";
import { suggestQuestions } from "@/lib/llm";

const QuerySchema = z.object({
  memberId: z.string().min(1).default("dadi"),
  displayLang: z.string().min(2).max(8).default("en"),
});

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    memberId: searchParams.get("memberId") ?? undefined,
    displayLang: searchParams.get("displayLang") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid-suggest" }, { status: 400 });
  }
  const displayLang = normalizeDisplayLang(parsed.data.displayLang);
  const { questions, cached, cost } = await suggestQuestions(
    { memberId: parsed.data.memberId, displayLang },
    { store: serverStore, ledger: serverLedger },
  );
  return Response.json({ questions, displayLang, cached, cost });
}
