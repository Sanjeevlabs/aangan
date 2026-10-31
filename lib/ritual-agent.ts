// Ritual agent planner (M4): pure, testable occasion scan.
// 7 days before an occasion -> ask every grown-up for a wish (elders: a
// blessing), voice or photo; day 3 -> remind the missing; occasion morning -> assemble the
// reel for 8am recipient delivery. Also assigns elder daily roles.
// Festival dates come from the family's holiday calendar (lib/holidays.ts).
import { ritualRunId } from "./rituals";
import type { DailyRole, Member, RitualRun, Wish } from "./schemas";

export interface RitualConfigRef {
  slug: string;
  title: string;
}

export interface PlannedSuggestion {
  goal: string;
  payload: Record<string, unknown>;
}

export interface PlannedRole {
  memberId: string;
  prompt: string;
  roleDate: string;
}

export interface ScanPlan {
  ensureRuns: { slug: string; occasionDate: string }[];
  deliverRuns: string[];
  suggestions: PlannedSuggestion[];
  roles: PlannedRole[];
}

// Deterministic elder role prompts per display language (data tables;
// cycled by day-of-year so every day has a role without a model call).
const ROLE_PROMPTS: Record<string, string[]> = {
  en: [
    "Today: teach Aria one word",
    "Today: bless Leo's exam",
    "Today: tell one courtyard story by voice",
    "Today: sing one line of a lullaby",
  ],
  "hi-latn": [
    "Aaj: Aria ko ek shabd sikhao",
    "Aaj: Leo ke exam ke liye dua do",
    "Aaj: aangan ki ek kahani sunao",
    "Aaj: lori ki ek pankti gao",
  ],
  "hi-deva": [
    "आज: आरिया को एक शब्द सिखाओ",
    "आज: लियो की परीक्षा के लिए दुआ दो",
    "आज: आँगन की एक कहानी सुनाओ",
    "आज: लोरी की एक पंक्ति गाओ",
  ],
};

export function rolePromptFor(displayLang: string, dayOfYear: number): string {
  const table = ROLE_PROMPTS[displayLang] ?? ROLE_PROMPTS.en;
  return table[dayOfYear % table.length];
}

function dayOfYear(d: Date): number {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nextBirthdayDate(mmdd: string, now: Date): Date {
  const [m, d] = mmdd.split("-").map(Number);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let next = new Date(Date.UTC(now.getUTCFullYear(), (m || 1) - 1, d || 1));
  if (next < start) next = new Date(Date.UTC(now.getUTCFullYear() + 1, (m || 1) - 1, d || 1));
  return next;
}

export interface ScanState {
  runs: RitualRun[];
  wishes: Wish[];
  roles: DailyRole[];
}

/**
 * Pure scan: given today + family state, decide runs/suggestions/roles.
 * Occasions = member birthdays + movable config dates within 7 days.
 */
export function planRitualScan(
  nowISO: string,
  members: Member[],
  configs: RitualConfigRef[],
  movableDates: Record<string, string>,
  state: ScanState,
  familyId: string = members[0]?.familyId ?? "demo-family",
): ScanPlan {
  const now = new Date(nowISO);
  const today = toISODate(now);
  const doy = dayOfYear(now);
  const plan: ScanPlan = { ensureRuns: [], deliverRuns: [], suggestions: [], roles: [] };

  // Daily roles for elders (idempotent: assignDailyRole keeps existing).
  for (const m of members) {
    if (m.role !== "elder") continue;
    if (!state.roles.some((r) => r.memberId === m.id && r.roleDate === today)) {
      plan.roles.push({ memberId: m.id, prompt: rolePromptFor(m.displayLang ?? "en", doy), roleDate: today });
    }
  }

  interface Occasion {
    slug: string;
    title: string;
    date: Date;
    birthdayMember?: Member;
  }
  const occasions: Occasion[] = [];
  for (const m of members) {
    if (!m.birthday) continue;
    const date = nextBirthdayDate(m.birthday, now);
    occasions.push({ slug: "birthday", title: `${m.displayName}'s birthday`, date, birthdayMember: m });
  }
  for (const c of configs) {
    if (c.slug === "birthday") continue; // birthdays come from the graph
    const iso = movableDates[c.slug];
    if (!iso) continue;
    const date = new Date(`${iso}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) continue;
    occasions.push({ slug: c.slug, title: c.title.split(/\s+[—-]\s+/)[0].trim(), date });
  }

  for (const occ of occasions) {
    const days = Math.round((Date.UTC(occ.date.getUTCFullYear(), occ.date.getUTCMonth(), occ.date.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
    if (days < 0 || days > 7) continue;
    const occasionDate = toISODate(occ.date);
    const runId = ritualRunId(familyId, occ.slug, occasionDate);
    const existing = state.runs.find((r) => r.id === runId);
    if (!existing) {
      plan.ensureRuns.push({ slug: occ.slug, occasionDate });
    }
    const active = existing ?? { id: runId, status: "open" as const };
    void active;
    if (days === 0) {
      if (existing && (existing.status === "open" || existing.status === "collecting")) {
        plan.deliverRuns.push(runId);
        plan.suggestions.push({
          goal: `Assemble the reel for ${occ.title}`,
          payload: { action: "assemble_reel", ritualRunId: runId, occasionDate },
        });
      }
      continue;
    }
    if (days <= 7 && days > 3) {
      // 7-day window: every grown-up (not child accounts) is asked for a
      // wish, elders for a blessing, voice or photo. The scan route skips a
      // suggestion it has already made, so this stays idempotent.
      for (const m of members) {
        if (m.role === "child") continue;
        if (occ.birthdayMember && m.id === occ.birthdayMember.id) continue;
        const kind = m.role === "elder" ? "blessing" : "wish";
        const already = state.wishes.some((w) => w.ritualRunId === runId && w.memberId === m.id);
        if (already) continue;
        const prompt = `Record a ${kind} for ${occ.title}`;
        plan.suggestions.push({
          goal: prompt,
          payload: { action: "request_wish", ritualRunId: runId, memberId: m.id, kind, prompt, occasionDate, media: ["voice", "photo"] },
        });
      }
    }
    if (days <= 3 && existing) {
      // Day 3: remind the missing grown-ups (no wish row yet for this run).
      for (const m of members) {
        if (m.role === "child") continue;
        if (occ.birthdayMember && m.id === occ.birthdayMember.id) continue;
        const missing = !state.wishes.some((w) => w.ritualRunId === runId && w.memberId === m.id);
        if (!missing) continue;
        plan.suggestions.push({
          goal: `Remind ${m.displayName}: ${occ.title} is in ${days} days`,
          payload: { action: "schedule_notification", text: `${m.displayName}, ${occ.title} is in ${days} days — send a voice wish.` },
        });
      }
    }
  }

  return plan;
}
