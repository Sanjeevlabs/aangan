import { CreateCardRequestSchema } from "@/lib/schemas";
import { resolveTakenAt } from "@/lib/dating";
import { captionCard } from "@/lib/llm";
import { serverLedger, serverStore } from "@/lib/llm-server";
import { addCard, listCards } from "@/lib/store";

export async function GET(): Promise<Response> {
  return Response.json({ cards: listCards() });
}

export async function POST(req: Request): Promise<Response> {
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
  const data = { ...parsed.data };
  // Video understanding: an empty video caption is grounded by Muse Spark
  // (structured output, one retry then fallback) and dated EXIF/file first,
  // model date only as fallback — never the future.
  if (data.type === "video" && !data.caption.trim()) {
    const mediaId = data.mediaRef ?? crypto.randomUUID();
    const { caption } = await captionCard(`A short family video moment. Tagged: none.`, {
      mediaId,
      store: serverStore,
      ledger: serverLedger,
    });
    data.caption = caption.caption;
    data.lang = caption.language;
    data.takenAt = resolveTakenAt({ modelDate: caption.takenAt });
  }
  const card = addCard({
    id: crypto.randomUUID(),
    familyId: "demo-family",
    summary: "",
    ritualSlug: null,
    ...data,
  });
  return Response.json({ card }, { status: 201 });
}
