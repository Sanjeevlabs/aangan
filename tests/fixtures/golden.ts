// Golden eval set: synthetic cards only. Expectations are properties,
// never exact text. Run manually: npm run eval:golden (needs META_API_KEY).
export interface GoldenCase {
  id: string;
  kind: "photo" | "audio" | "video";
  prompt: string;
  mediaId: string;
  taggedMembers: string[];
  expectLang: string;
  expectDateSource: "exif" | "file" | "model" | "now";
  exifDate?: string | null;
  fileModifiedAt?: string | null;
}

export const GOLDEN: GoldenCase[] = [
  { id: "g-photo-en", kind: "photo", prompt: "A family dinner photo. Tagged: Amma.", mediaId: "g1", taggedMembers: ["Amma"], expectLang: "en", expectDateSource: "exif", exifDate: "2025-12-25T19:00:00.000Z" },
  { id: "g-photo-hi", kind: "photo", prompt: "A birthday photo, reply in Hindi. Tagged: Dada.", mediaId: "g2", taggedMembers: ["Dada"], expectLang: "hi", expectDateSource: "file", fileModifiedAt: "2026-01-14T08:00:00.000Z" },
  { id: "g-audio-en", kind: "audio", prompt: "A lullaby voice note. Tagged: Meera, Arjun.", mediaId: "g3", taggedMembers: ["Meera", "Arjun"], expectLang: "en", expectDateSource: "file", fileModifiedAt: "2026-03-02T21:00:00.000Z" },
  { id: "g-audio-hi", kind: "audio", prompt: "A birthday song voice note, reply in Hindi. Tagged: Nani.", mediaId: "g4", taggedMembers: ["Nani"], expectLang: "hi", expectDateSource: "now" },
  { id: "g-video-en", kind: "video", prompt: "A 20s clip of lighting diyas. Tagged: Papa.", mediaId: "g5", taggedMembers: ["Papa"], expectLang: "en", expectDateSource: "exif", exifDate: "2025-11-01T18:00:00.000Z" },
  { id: "g-no-names", kind: "photo", prompt: "A landscape from the trip. No people tagged.", mediaId: "g6", taggedMembers: [], expectLang: "en", expectDateSource: "now" },
  { id: "g-future-exif", kind: "photo", prompt: "A picnic photo with a corrupt future timestamp. Tagged: Zara.", mediaId: "g7", taggedMembers: ["Zara"], expectLang: "en", expectDateSource: "file", exifDate: "2099-01-01T00:00:00.000Z", fileModifiedAt: "2026-05-05T10:00:00.000Z" },
  { id: "g-empty-audio", kind: "audio", prompt: "A silent 3s clip. Tagged: Kabir.", mediaId: "g8", taggedMembers: ["Kabir"], expectLang: "en", expectDateSource: "now" },
  { id: "g-long-names", kind: "photo", prompt: "A reunion photo. Tagged: Amma, Dada, Meera.", mediaId: "g9", taggedMembers: ["Amma", "Dada", "Meera"], expectLang: "en", expectDateSource: "file", fileModifiedAt: "2026-08-15T12:00:00.000Z" },
];
