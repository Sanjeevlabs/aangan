import { describe, expect, it } from "vitest";
import {
  buildTranscribeForm,
  buildVisionMessages,
  parseTranscribeResponse,
  sha256Hex,
  transcribeVoice,
  TRANSCRIPT_UNAVAILABLE,
} from "@/lib/llm";

// Fix 1: the live request bodies must carry the media payload — audio bytes
// for voice (06_muse_voice/01), image bytes for vision (01_api_fundamentals/07).
// These tests assert the builders, so no network is needed.
describe("real media to models (request builders)", () => {
  const bytes = new Uint8Array([82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 1, 2, 3, 4]);

  it("transcribe form carries the audio file part + recipe params", async () => {
    const { form, hash } = buildTranscribeForm(bytes, { langHint: "hi-latn", keywords: ["Dadi"] });
    expect(hash).toBe(sha256Hex(bytes));
    expect(hash).toHaveLength(64);

    const params = JSON.parse(await (form.get("request") as Blob).text()) as Record<string, unknown>;
    expect(params.mode).toBe("PUSH_TO_TALK");
    expect(params.model).toBe("muse-voice-transcribe-1.0");
    expect(params.audioEncoding).toBe("WAV");

    const audio = form.get("audio");
    expect(audio).toBeInstanceOf(Blob);
    const sent = new Uint8Array(await (audio as Blob).arrayBuffer());
    expect(Array.from(sent)).toEqual(Array.from(bytes));
  });

  it("transcribe parser turns response turns into timed lyric segments", () => {
    const parsed = parseTranscribeResponse(
      {
        transcript: "Subah ki dua. Aaj ka din achha ho.",
        audioDurationMs: 8000,
        turns: [
          { startMs: 0, transcript: "Subah ki dua." },
          { startMs: 4000, transcript: "Aaj ka din achha ho." },
        ],
      },
      "hi-latn",
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.segments).toHaveLength(2);
    expect(parsed?.segments[0]).toMatchObject({ start: 0, end: 4, text: "Subah ki dua." });
    expect(parsed?.segments[1]).toMatchObject({ start: 4, end: 8 });
    expect(parsed?.transcript).toContain("Subah ki dua.");
  });

  it("transcribe parser returns null when there is nothing to transcribe", () => {
    expect(parseTranscribeResponse({ transcript: "", turns: [] }, "en")).toBeNull();
    expect(parseTranscribeResponse(null, "en")).toBeNull();
  });

  it("vision messages put the image in a USER message as image_url", () => {
    const images = [
      { bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg" },
      { bytes: new Uint8Array([4, 5, 6]), mime: "image/png" },
    ];
    const messages = buildVisionMessages("A birthday photo. Tagged: Dadi.", images);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const parts = messages[0].content;
    expect(parts[0]).toMatchObject({ type: "text" });
    const urls = parts.filter((p) => p.type === "image_url");
    expect(urls).toHaveLength(2);
    expect(urls[0].image_url?.url.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(urls[1].image_url?.url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("transcription without bytes is unavailable, never invented", async () => {
    const { transcript, unavailable, cost } = await transcribeVoice({ langHint: "en" });
    expect(unavailable).toBe(true);
    expect(cost).toBe(0);
    expect(transcript.transcript).toBe(TRANSCRIPT_UNAVAILABLE);
    expect(transcript.segments).toEqual([]);
  });
});
