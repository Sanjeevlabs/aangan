// Pure text helpers safe for client bundles (no Node built-ins).
export function containsDevanagari(s: string): boolean {
  return /[ऀ-ॿ]/.test(s);
}
