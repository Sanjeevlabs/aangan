import { DEMO_FAMILY } from "@/lib/family";
import { dbListMembers } from "@/lib/db";

export async function GET(): Promise<Response> {
  return Response.json({ members: await dbListMembers(), family: DEMO_FAMILY });
}
