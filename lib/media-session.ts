// Media backend seam. M1 is mock-first: blobs live in a client session map and
// only metadata (mediaRef) reaches the server. When the Supabase project is
// confirmed, `resolveMediaUrl` becomes signed-URL resolution and uploads go
// direct-to-storage — callers do not change.

export type MediaBackendKind = "session" | "supabase";

export function mediaBackendKind(): MediaBackendKind {
  return "session";
}

const blobs = new Map<string, { blob: Blob; url: string | null }>();

function newRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `media-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

// Stores a blob for this session; returns its ref. Object URLs do not survive
// reload — that limitation disappears with the Supabase backend.
export function putSessionMedia(blob: Blob): { ref: string; url: string | null } {
  const ref = newRef();
  let url: string | null = null;
  try {
    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      url = URL.createObjectURL(blob);
    }
  } catch {
    url = null;
  }
  blobs.set(ref, { blob, url });
  return { ref, url };
}

export function getSessionMedia(ref: string): { blob: Blob; url: string | null } | undefined {
  return blobs.get(ref);
}

// Single swap point: every component resolves card/home media through here.
// Private-bucket refs (`storage:<path>`) resolve to the signed-URL proxy,
// which redirects (307) to a short-lived signed URL per request — media
// survives reloads. Session refs (this tab only) still work as before.
export function resolveMediaUrl(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.startsWith("storage:")) return `/api/media/${ref.slice("storage:".length)}`;
  // Our own storage, same-origin files and local previews only. A ref naming
  // another host ("https://…", "//host/…") is never loaded: it would let one
  // member's card act as a tracking pixel on everyone else's screen.
  if (ref.startsWith("blob:") || (ref.startsWith("/") && !ref.startsWith("//"))) return ref;
  return blobs.get(ref)?.url ?? null;
}

export function clearSessionMedia(): void {
  blobs.clear();
}
