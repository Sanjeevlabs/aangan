// Runs the Muse agent once for a family's weekly letter and stores the
// proposal as a pending suggestion. Shared by the weekly scan and the manual
// route. Server only.
import { runAgent } from "./agent";
import { weeklyLetterTool } from "./agent-tools";
import { dbAddAgentRun, dbAddSuggestion } from "./db";
import { serverLedger, serverStore } from "./llm-server";
import type { Suggestion } from "./schemas";
import { gatherWeekFacts, weekStartOf, weeklyLetterMade } from "./weekly-letter";

export const LETTER_AGENT_GOAL = "Draft this week's letter from the courtyard";

export type LetterOutcome =
  | { status: "created"; suggestion: Suggestion }
  | { status: "exists"; suggestion: Suggestion }
  | { status: "quiet-week" }
  | { status: "skipped" };

/**
 * One letter per family per week. `scan` (the cron) also skips a week the
 * family already declined and needs at least 3 facts; a person asking
 * (`manual`) may draft again after a "Not now" and needs at least 1.
 */
export async function draftWeeklyLetter(familyId: string, opts: { lang: "en" | "hi"; by: "scan" | "manual" }): Promise<LetterOutcome> {
  const weekStart = weekStartOf();
  const made = await weeklyLetterMade(familyId, weekStart, opts.by === "scan" ? "any" : "live");
  if (made) return opts.by === "scan" ? { status: "skipped" } : { status: "exists", suggestion: made };
  const minFacts = opts.by === "scan" ? 3 : 1;
  // Count first, so a quiet week costs no model call.
  if ((await gatherWeekFacts(familyId)).facts.length < minFacts) return { status: "quiet-week" };
  const tool = weeklyLetterTool(familyId, { lang: opts.lang, minFacts });
  const result = await runAgent(LETTER_AGENT_GOAL, [tool], { store: serverStore, ledger: serverLedger });
  await dbAddAgentRun({ familyId, goal: LETTER_AGENT_GOAL, tools: result.toolCalls.map((c) => c.name), status: result.status });
  const draft = result.suggestions[0];
  if (!draft) return { status: "quiet-week" };
  return { status: "created", suggestion: await dbAddSuggestion({ goal: draft.goal, payload: draft.payload, familyId }) };
}
