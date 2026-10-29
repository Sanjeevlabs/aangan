// Plain value lists for the living rooms. No zod here, so client screens
// can import them without pulling the validator into the browser bundle.

export const PRESENCE_MOMENTS = ["awake", "chai", "walk", "cooking", "prayer", "garden", "market", "resting", "visitors", "thinking", "here"] as const;
export const NEED_KINDS = ["groceries", "house", "ride", "repair", "gas", "bills", "health", "errand", "visit", "pets", "other"] as const;
/** Ticket lifecycle. "claimed" = assigned to a family member (kept for old rows). */
export const NEED_STATUSES = ["open", "claimed", "progress", "done", "cancelled"] as const;
export const PRIORITIES = ["normal", "soon", "urgent"] as const;
export const RECURRENCE = ["none", "weekly", "monthly"] as const;
export const COURSES = ["breakfast", "main", "side", "snack", "sweet", "drink", "other"] as const;
export const SAFETY_KINDS = ["home-safe", "heading", "journey", "out-late", "help"] as const;
export const PET_SPECIES = ["dog", "cat", "bird", "fish", "rabbit", "other"] as const;
export const HELPER_ROLES = ["groceries", "house help", "driver", "cook", "gas booking", "repairs", "plumber", "electrician", "neighbour", "caregiver", "doctor's clinic", "pet care", "other"] as const;
export const SITTING_REASONS = ["chai", "cook", "story", "festival", "birthday", "music", "just-sit"] as const;
