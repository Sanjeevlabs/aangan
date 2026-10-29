import { RitualConfigSchema, type RitualConfig } from "./schemas";

// Ritual engine: loads ANY festival config. No festival or culture is named
// in this module; all specifics live in the JSON configs.
export function loadRitualConfig(json: unknown): RitualConfig {
  return RitualConfigSchema.parse(json);
}

export interface RitualStepInput {
  kind: "photo" | "audio" | "video" | "text";
  mediaId: string;
  text?: string;
}

export interface RitualCardDraft {
  template: string;
  stepKey: string;
  input: RitualStepInput;
}

// Maps each completed step to its card template, in order.
export function draftCards(config: RitualConfig, inputs: RitualStepInput[]): RitualCardDraft[] {
  const byKind = new Map(inputs.map((i) => [i.kind, i] as const));
  const drafts: RitualCardDraft[] = [];
  for (const step of config.steps) {
    const input = byKind.get(step.kind);
    if (!input) continue;
    drafts.push({ template: step.cardTemplate, stepKey: step.key, input });
  }
  return drafts;
}


/** Family-scoped ritual run id. The demo family keeps the original short form. */
export function ritualRunId(familyId: string, slug: string, occasionDate: string): string {
  return familyId === "demo-family" ? `${slug}:${occasionDate}` : `${familyId}:${slug}:${occasionDate}`;
}
