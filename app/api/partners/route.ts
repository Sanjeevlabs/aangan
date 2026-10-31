import { requireSession } from "@/lib/auth";
import { isMockMode } from "@/lib/config";
import { ACCOUNTS, PARTNERS, isEnabled } from "@/lib/partners/registry";
import { connections } from "@/lib/partners/tokens";

const KIND_LABEL: Record<string, string> = { groceries: "Groceries", food: "Food", dining: "Dining", gifts: "Gifts", "home-services": "Home services" };

// GET → the curated partners and which accounts this member has connected.
// Status only: tokens never leave the server.
export async function GET(req: Request): Promise<Response> {
  const auth = await requireSession(req);
  if (auth instanceof Response) return auth;
  const mine = new Map((await connections(auth.familyId, auth.memberId)).map((c) => [c.account, c.connectedAt]));
  const accounts = ACCOUNTS.filter((a) => isEnabled({ envFlag: a.envFlag, defaultOn: false })).map((a) => ({
    id: a.id,
    name: a.name,
    connected: mine.has(a.id),
    connectedAt: mine.get(a.id) ?? null,
    partners: PARTNERS.filter((p) => p.account === a.id).map((p) => p.name.replace(new RegExp(`^${a.name}\\s*`), "") || KIND_LABEL[p.kind]),
  }));
  const open = PARTNERS.filter((p) => p.account === null && isEnabled(p)).map((p) => ({ id: p.id, name: p.name, kind: p.kind, transport: p.transport, url: p.transport === "link" ? (p.url ?? null) : null }));
  return Response.json({ sample: isMockMode(), accounts, open });
}
