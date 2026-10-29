// Plain value lists for the living rooms. No zod here, so client screens
// can import them without pulling the validator into the browser bundle.

export const PRESENCE_MOMENTS = ["awake", "chai", "walk", "cooking", "prayer", "garden", "market", "resting", "visitors", "thinking", "here"] as const;
export const NEED_KINDS = ["groceries", "house", "ride", "repair", "gas", "errand", "visit", "other"] as const;
export const HELPER_ROLES = ["groceries", "house help", "driver", "cook", "gas booking", "repairs", "neighbour", "caregiver", "doctor's clinic", "other"] as const;
export const SITTING_REASONS = ["chai", "cook", "story", "festival", "birthday", "music", "just-sit"] as const;
