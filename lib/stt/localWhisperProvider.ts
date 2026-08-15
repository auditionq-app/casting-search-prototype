import { nodewhisper } from "nodejs-whisper";
import type { SpeechToTextProvider } from "./types";

const NON_SPEECH_PATTERNS = [
  /^\[.*music.*\]$/i,
  /^\[.*blank.*\]$/i,
  /^\[.*silence.*\]$/i,
  /^\[.*noise.*\]$/i,
  /^\[.*applause.*\]$/i,
  /^\[.*laughter.*\]$/i,
  /^\[.*laughing.*\]$/i,
  /^\[.*inaudible.*\]$/i,
  /^\(speaking in .*language\)$/i,
];

export class LocalWhisperProvider implements SpeechToTextProvider {
  async transcribe(audioFilePath: string): Promise<{ text: string }> {
    const result = await nodewhisper(audioFilePath, {
      modelName: "base.en",
      autoDownloadModelName: "base.en",
      whisperOptions: {},
      removeWavFileAfterTranscription: false,
    });

    const raw = String(result ?? "");

    const text = raw
      .split("\n")
      .map((line) =>
        line
          .replace(
            /^\s*\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/,
            ""
          )
          .trim()
      )
      .filter(Boolean)
      .filter(
        (line) =>
          !NON_SPEECH_PATTERNS.some((pattern) => pattern.test(line))
      )
      .join(" ")
      .trim();

    return { text };
  }
}