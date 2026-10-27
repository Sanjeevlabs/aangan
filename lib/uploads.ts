export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_SECONDS = 30;

export type UploadKind = "photo" | "audio" | "video";

export interface UploadMeta {
  kind: UploadKind;
  bytes: number;
  durationSeconds?: number;
  mime: string;
}

export function validateUpload(meta: UploadMeta): string | null {
  if (meta.kind === "photo" && meta.bytes > MAX_IMAGE_BYTES) {
    return `image exceeds 5 MB (${Math.round(meta.bytes / 1024 / 1024)} MB)`;
  }
  if (meta.kind === "video") {
    if (meta.bytes > MAX_VIDEO_BYTES) return "video exceeds 25 MB";
    if ((meta.durationSeconds ?? 0) > MAX_VIDEO_SECONDS) return "video exceeds 30s";
    if (meta.durationSeconds === undefined) return "video duration unknown";
  }
  return null;
}

// Thumbnail: generated client-side (canvas frame) at upload time and stored
// alongside the video. Server keeps the reference; see store + schema.
export function thumbnailPathFor(videoPath: string): string {
  return videoPath.replace(/(\.[a-z0-9]+)$/i, "-thumb.jpg");
}
