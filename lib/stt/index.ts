import { LocalWhisperProvider } from "./localWhisperProvider";
import type { SpeechToTextProvider } from "./types";

export const sttProvider: SpeechToTextProvider = new LocalWhisperProvider();
