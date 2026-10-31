/** /trace is a developer and judging view: on in dev and mock mode, off in production. */
export function traceVisible(env: Record<string, string | undefined> = process.env): boolean {
  return env.MOCK === "true" || env.NODE_ENV !== "production";
}
