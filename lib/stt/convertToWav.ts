import ffmpeg from "fluent-ffmpeg";

export function convertToWav(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .toFormat("wav")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}
