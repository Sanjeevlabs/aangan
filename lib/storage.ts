// Private-bucket media via server-issued signed URLs (Fix 2).
// The bucket is private (no public reads); the server mints short-lived
// URLs for upload (PUT) and download (redirect). In mock mode (no Supabase
// keys) bytes live in a process-memory map so tests and mock dev keep
// working; live Supabase persists them across reloads. Only the seed families
// use the in-memory store; a demo visitor's copy uploads to the bucket under
// its own family id and is purged with it after 48 hours.
import { isSeedFamily } from "./family";
import { isDbLive, supabaseServer } from "./supabase";

export const MEDIA_BUCKET = "family-media";
export const DOWNLOAD_TTL_SECONDS = 3600;

interface StoredBlob {
  bytes: Uint8Array;
  mime: string;
}

const mockBlobs = new Map<string, StoredBlob>();
// The public demo keeps uploads in process memory: past this budget the
// oldest go first, so visitors can't grow one instance without bound.
const MOCK_BLOB_BUDGET = 64 * 1024 * 1024;
let mockBytes = 0;

export function mockPutBlob(path: string, bytes: Uint8Array, mime: string): void {
  const prev = mockBlobs.get(path);
  if (prev) {
    mockBytes -= prev.bytes.byteLength;
    mockBlobs.delete(path);
  }
  for (const [oldest, blob] of mockBlobs) {
    if (mockBytes + bytes.byteLength <= MOCK_BLOB_BUDGET) break;
    mockBytes -= blob.bytes.byteLength;
    mockBlobs.delete(oldest);
  }
  mockBlobs.set(path, { bytes, mime });
  mockBytes += bytes.byteLength;
}

export function mockGetBlob(path: string): StoredBlob | undefined {
  return mockBlobs.get(path);
}

export function mockClearBlobs(): void {
  mockBlobs.clear();
  mockBytes = 0;
}

/**
 * True when this path's bytes live in the in-memory store: no live database,
 * or the path belongs to a demo family (paths start with the family id).
 */
export function usesMockStorage(path: string): boolean {
  return !isDbLive() || isSeedFamily(path.split("/")[0] ?? "");
}

export function storagePath(familyId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "media";
  return `${familyId}/uploads/${crypto.randomUUID()}/${safe}`;
}

export async function createUploadUrl(
  path: string,
  mime: string,
): Promise<{ uploadUrl: string; mock: boolean }> {
  if (usesMockStorage(path)) return { uploadUrl: `/api/media/mock-upload?path=${encodeURIComponent(path)}&mime=${encodeURIComponent(mime)}`, mock: true };
  const sb = supabaseServer();
  if (!sb) return { uploadUrl: `/api/media/mock-upload?path=${encodeURIComponent(path)}&mime=${encodeURIComponent(mime)}`, mock: true };
  const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) {
    return { uploadUrl: `/api/media/mock-upload?path=${encodeURIComponent(path)}&mime=${encodeURIComponent(mime)}`, mock: true };
  }
  return { uploadUrl: data.signedUrl, mock: false };
}

export async function createDownloadUrl(path: string): Promise<{ url: string; mock: boolean } | null> {
  if (usesMockStorage(path)) return mockBlobs.has(path) ? { url: `/api/media/mock-bytes?path=${encodeURIComponent(path)}`, mock: true } : null;
  const sb = supabaseServer();
  if (!sb) return mockBlobs.has(path) ? { url: `/api/media/mock-bytes?path=${encodeURIComponent(path)}`, mock: true } : null;
  const { data, error } = await sb.storage.from(MEDIA_BUCKET).createSignedUrl(path, DOWNLOAD_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return { url: data.signedUrl, mock: false };
}
