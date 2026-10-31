// Talks to one partner's MCP server with the member's own token: fills the
// tool argument templates from data/partners.json, refreshes an expired
// token once, and reports "needs connect" when the partner refuses it.
// Server only. Tokens stay inside this module's calls; never logged.
import { McpClient, McpError, toolJson } from "./mcp-client";
import { refreshTokens } from "./oauth";
import { getAccount, serverUrl, type Partner, type ToolSpec } from "./registry";
import { deleteToken, loadToken, saveToken, type TokenSet } from "./tokens";

export class NeedsConnect extends Error {
  constructor(public readonly account: string) {
    super("needs-connect");
    this.name = "NeedsConnect";
  }
}

/** Replace "$name" leaves with values; a leaf that is exactly "$name" keeps the value's type. */
export function fillArgs(template: unknown, vars: Record<string, string | number | undefined>): unknown {
  if (typeof template === "string" && /^\$\w+$/.test(template)) {
    const v = vars[template.slice(1)];
    return v === undefined ? undefined : v;
  }
  if (Array.isArray(template)) return template.map((t) => fillArgs(t, vars));
  if (template && typeof template === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template)) {
      const filled = fillArgs(v, vars);
      if (filled !== undefined) out[k] = filled;
    }
    return out;
  }
  return template;
}

export interface PartnerSession {
  call(spec: ToolSpec | undefined, vars?: Record<string, string | number | undefined>): Promise<unknown>;
}

async function usableToken(familyId: string, memberId: string, account: string): Promise<TokenSet> {
  const t = await loadToken(familyId, memberId, account);
  if (!t) throw new NeedsConnect(account);
  if (t.expiresAt && t.expiresAt < Date.now() + 60_000) {
    const acct = getAccount(account);
    const fresh = acct ? await refreshTokens(acct, t) : null;
    if (!fresh) {
      await deleteToken(familyId, memberId, account);
      throw new NeedsConnect(account);
    }
    await saveToken(familyId, memberId, account, fresh);
    return fresh;
  }
  return t;
}

/** An MCP session for this member on this partner (mcp-oauth needs their token). */
export async function openPartner(familyId: string, memberId: string, partner: Partner): Promise<PartnerSession> {
  const url = serverUrl(partner);
  if (!url) throw new Error("partner-no-url");
  const token = partner.transport === "mcp-oauth" && partner.account ? (await usableToken(familyId, memberId, partner.account)).accessToken : undefined;
  const client = new McpClient(url, { token });
  return {
    async call(spec, vars = {}) {
      if (!spec) return null;
      try {
        return toolJson(await client.callTool(spec.name, fillArgs(spec.args, vars) as Record<string, unknown>));
      } catch (err) {
        if (err instanceof McpError && err.code === "unauthorized" && partner.account) throw new NeedsConnect(partner.account);
        throw err;
      }
    },
  };
}
