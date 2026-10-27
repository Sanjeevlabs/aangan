import { DEMO_FAMILY } from "@/lib/family";
import { listMembers } from "@/lib/store";

export async function GET(): Promise<Response> {
  return Response.json({ members: listMembers(), family: DEMO_FAMILY });
}
