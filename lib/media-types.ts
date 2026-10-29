// Photos, voices and videos only: never HTML, SVG or scripts, which a browser
// would run on the app's origin if served back. Codec parameters are ignored
// ("audio/webm;codecs=opus" → "audio/webm").
const MEDIA_MIME = /^(image\/(jpeg|png|webp|gif|heic|heif)|audio\/(webm|ogg|mpeg|mp4|aac|wav|x-m4a)|video\/(mp4|webm|quicktime))$/;

export function baseMime(mime: string): string {
  return mime.split(";")[0].trim().toLowerCase();
}

export function isMediaMime(mime: string): boolean {
  return MEDIA_MIME.test(baseMime(mime));
}
