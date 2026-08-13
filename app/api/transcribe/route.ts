import { writeFile, unlink } from "fs/promises";
import path from "path";
import os from "os";
import { sttProvider } from "@/lib/stt";
import { convertToWav } from "@/lib/stt/convertToWav";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("audio") as File | null;

  if (!file) {
    return Response.json({ error: "No audio provided" }, { status: 400 });
  }

  const inputPath = path.join(os.tmpdir(), `query-${Date.now()}.webm`);
  const wavPath = inputPath.replace(".webm", ".wav");

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(inputPath, buffer);

  try {
    await convertToWav(inputPath, wavPath);
    const { text } = await sttProvider.transcribe(wavPath);
    return Response.json({ text });
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
