import { dbListRitualRuns } from "@/lib/db";

export async function GET(): Promise<Response> {
  return Response.json({ runs: await dbListRitualRuns() });
}
