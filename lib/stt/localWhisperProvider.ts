import { nodewhisper } from "nodejs-whisper";
import type { SpeechToTextProvider } from "./types";

export class LocalWhisperProvider implements SpeechToTextProvider {
  async transcribe(audioFilePath: string): Promise<{ text: string }> {
    const result = await nodewhisper(audioFilePath, {
      modelName: "base.en",
      autoDownloadModelName: "base.en",
      whisperOptions: {
        outputInText: true,
      },
    });

    return { text: result.trim() };
  }
}
