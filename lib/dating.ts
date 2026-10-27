// Auto-dating: EXIF/file metadata first, model only as fallback.

export interface DateSources {
  exifDate?: string | null; // DateTimeOriginal from the file, ISO string
  fileModifiedAt?: string | null; // filesystem mtime, ISO string
  modelDate?: string | null; // model guess, ISO string or null
}

export function resolveTakenAt(src: DateSources, now = new Date()): string {
  const valid = (d: string | null | undefined): string | null => {
    if (!d) return null;
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return null;
    if (t.getTime() > now.getTime()) return null; // never date in the future
    return t.toISOString();
  };
  return valid(src.exifDate) ?? valid(src.fileModifiedAt) ?? valid(src.modelDate) ?? now.toISOString();
}

export function dateSourceUsed(src: DateSources): "exif" | "file" | "model" | "now" {
  if (src.exifDate && !Number.isNaN(new Date(src.exifDate).getTime())) return "exif";
  if (src.fileModifiedAt && !Number.isNaN(new Date(src.fileModifiedAt).getTime())) return "file";
  if (src.modelDate && !Number.isNaN(new Date(src.modelDate).getTime())) return "model";
  return "now";
}
