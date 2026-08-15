import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { sttProvider } from "@/lib/stt";
import { convertToWav } from "@/lib/stt/convertToWav";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inputPath = path.join(os.tmpdir(), `query-${id}.webm`);
  const wavPath = path.join(os.tmpdir(), `query-${id}.wav`);

  try {
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "No audio provided" },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return Response.json(
        { error: "Audio file is empty" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json(
        { error: "Audio file is too large" },
        { status: 413 }
      );
    }

    if (file.type && !file.type.startsWith("audio/")) {
      return Response.json(
        { error: "Audio file is not a supported audio type" },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    await writeFile(inputPath, buffer);

    await convertToWav(inputPath, wavPath);

    const { text } = await sttProvider.transcribe(wavPath);

    const cleanedText = text.trim();

    if (!cleanedText) {
      return Response.json(
        { error: "No speech detected" },
        { status: 400 }
      );
    }

    return Response.json({
      text: cleanedText,
    });
  } catch (err) {
    console.error("Transcription failed:", err);

    return Response.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(wavPath).catch(() => {});
  }
}