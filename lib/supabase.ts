// Server-only Supabase client (service role, bypasses RLS).
// NEVER import from a client component: SUPABASE_SECRET_KEY must stay
// server-side. All data access goes through Next.js route handlers, which
// enforce family scoping + Zod validation in code.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

// True when the dev server should talk to Supabase: keys present AND the
// operator flipped MOCK off. Tests always run with MOCK=true (vitest env),
// so they never touch the network.
export function isDbLive(): boolean {
  if (process.env.MOCK === "true") return false;
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
