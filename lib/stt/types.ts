export interface SpeechToTextProvider {
  transcribe(audioFilePath: string): Promise<{ text: string }>;
}
