import type { TranscriptSegment } from "./schemas";
import { containsDevanagari } from "./llm";

// Pure M2 voice helpers. No model calls, no browser APIs — unit-tested.

// Split a transcript into timed lines covering totalSeconds. Used when the
// model returns no segment timestamps. Sentences split on . ! ? । |, words
// are packed at most ~8 per line, time distributed by character length.
export function estimateSegments(text: string, totalSeconds: number): TranscriptSegment[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const total = Math.max(1, totalSeconds);
  const parts = clean.split(/(?<=[.!?।|])\s+/).filter((s) => s.trim().length > 0);
  const lines: string[] = [];
  for (const part of parts) {
    const words = part.trim().split(/\s+/);
    for (let i = 0; i < words.length; i += 8) {
      lines.push(words.slice(i, i + 8).join(" "));
    }
  }
  if (lines.length === 0) return [];
  if (lines.length === 1) return [{ start: 0, end: total, text: lines[0] }];
  const chars = lines.map((l) => l.length);
  const sum = chars.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return lines.map((line, i) => {
    const share = (chars[i] / sum) * total;
    const start = cursor;
    const end = i === lines.length - 1 ? total : cursor + share;
    cursor = end;
    return { start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10, text: line };
  });
}

// Card-source language group: legacy "hi" counts as hi-deva.
export function sourceGroup(lang: string | null | undefined): "en" | "hi" {
  const l = (lang ?? "en").toLowerCase();
  return l === "hi" || l === "hi-deva" || l === "hi-latn" ? "hi" : "en";
}

// Whether the viewer needs a model translation/transliteration for text in
// sourceLang. en viewers need it for Devanagari text; hi-deva viewers for
// Latin-only text; hi-latn viewers for Devanagari text (transliteration).
export function needsDisplayText(
  text: string,
  sourceLang: string | null | undefined,
  displayLang: string,
): boolean {
  if (!text) return false;
  const hasDeva = containsDevanagari(text);
  if (displayLang === "en") return hasDeva;
  if (displayLang === "hi-deva") {
    if (sourceGroup(sourceLang) === "hi" && hasDeva) return false;
    return !hasDeva;
  }
  // hi-latn reads Latin script: translate only Devanagari content.
  return hasDeva;
}

// Deterministic HH:MM in UTC so tests and chips agree across time zones.
export function formatHeardTime(playedAt: string): string {
  const t = new Date(playedAt);
  if (Number.isNaN(t.getTime())) return "";
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const HEARD_VERB: Record<string, string> = {
  en: "heard this",
  "hi-latn": "ne ye suna",
  "hi-deva": "ने यह सुना",
};

// "Dadi heard this · 09:14" in the viewer's display_lang.
export function heardLine(memberName: string, playedAt: string, displayLang: string): string {
  const verb = HEARD_VERB[displayLang] ?? HEARD_VERB.en;
  const time = formatHeardTime(playedAt);
  return time ? `${memberName} ${verb} · ${time}` : `${memberName} ${verb}`;
}

const REACTION_VERB: Record<string, Record<string, string>> = {
  en: { love: "loved", laugh: "laughed at", bless: "blessed" },
  "hi-latn": { love: "ne pyaar bheja", laugh: "ne haskar khushi manayi", bless: "ne aashirvaad diya" },
  "hi-deva": { love: "ने प्यार भेजा", laugh: "ने हँसकर खुशी मनाई", bless: "ने आशीर्वाद दिया" },
};

// "Leo laughed at this" in the viewer's display_lang. Never a count.
export function reactionLine(memberName: string, kind: string, displayLang: string): string {
  const table = REACTION_VERB[displayLang] ?? REACTION_VERB.en;
  const verb = table[kind] ?? table.love;
  if (displayLang === "en") return `${memberName} ${verb} this`;
  return `${memberName} ${verb}`;
}
