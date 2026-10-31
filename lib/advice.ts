// Advice & blessings shelves. The shelves are data (data/advice-categories.json),
// never hard-coded culture. Classification is deterministic: an explicit
// category on the question wins, then a blessing stays a blessing, then
// keywords, then the fallback shelf ("Life & values"). Pure (client + server).
import { z } from "zod";
import raw from "../data/advice-categories.json";

const CategorySchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  label: z.string().min(2).max(40),
  note: z.string().max(80).optional(),
  placeholder: z.string().max(80).default(""),
  keywords: z.array(z.string().min(1).max(40)).default([]),
});
const FileSchema = z.object({ fallback: z.string(), categories: z.array(CategorySchema).min(1) });

const file = FileSchema.parse(raw);
export type AdviceCategory = z.infer<typeof CategorySchema>;
export const ADVICE_CATEGORIES: AdviceCategory[] = file.categories;
export const ADVICE_FALLBACK: string = ADVICE_CATEGORIES.some((c) => c.id === file.fallback) ? file.fallback : ADVICE_CATEGORIES[0].id;
const ids = ADVICE_CATEGORIES.map((c) => c.id) as [string, ...string[]];
/** Validates a category id (route bodies, and any model output). */
export const AdviceCategoryId = z.enum(ids);

const PATTERNS = ADVICE_CATEGORIES.map((c) => ({ id: c.id, re: c.keywords.length ? new RegExp(c.keywords.join("|"), "i") : null }));

export function adviceCategory(q: { text: string; topic?: string; category?: string | null }): string {
  if (q.category && AdviceCategoryId.safeParse(q.category).success) return q.category;
  if (q.topic === "blessing" && ADVICE_CATEGORIES.some((c) => c.id === "blessings")) return "blessings";
  // Specific shelves first (in file order), then blessings, then the general shelf.
  const rank = (id: string) => (id === ADVICE_FALLBACK ? 2 : id === "blessings" ? 1 : 0);
  const hit = [...PATTERNS].sort((a, b) => rank(a.id) - rank(b.id)).find((p) => p.re?.test(q.text));
  return hit?.id ?? ADVICE_FALLBACK;
}

export function categoryLabel(id: string): string {
  return ADVICE_CATEGORIES.find((c) => c.id === id)?.label ?? ADVICE_CATEGORIES.find((c) => c.id === ADVICE_FALLBACK)!.label;
}
