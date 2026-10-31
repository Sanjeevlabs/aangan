// AES-256-GCM sealing for partner tokens and the OAuth hand-off cookie.
// The key is derived from SESSION_SECRET, so a leaked row or cookie is
// unreadable without the server secret. Server only.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(purpose: string): Buffer | null {
  const s = process.env.SESSION_SECRET;
  if (!s) return null;
  return createHash("sha256").update(`aangan:${purpose}:${s}`).digest();
}

export function seal(purpose: string, value: unknown): string | null {
  const k = key(purpose);
  if (!k) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function unseal(purpose: string, sealed: string | null | undefined): unknown {
  const k = key(purpose);
  if (!k || !sealed) return null;
  const parts = sealed.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", k, iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}
