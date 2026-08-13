# Task: Add Voice Search to casting-search-prototype

## Context (read before starting)

- Project: `casting-search-prototype`, Next.js 16 App Router, TypeScript, Prisma 7.
- An existing hybrid semantic search pipeline is already working: `/api/search` route accepts a text query, runs it through a `QueryUnderstandingProvider` (Qwen2.5 local), then hybrid scoring (vector + lexical + softMatch) against pgvector.
- Goal: add a mic button to the search UI that records audio, transcribes it to text locally using `nodejs-whisper` (Node wrapper around whisper.cpp — no Python), and feeds that text into the exact same search flow already used for typed queries.
- Constraint: all-JS stack. Do not introduce Python or a separate microservice/port.
- Do NOT modify: `QueryUnderstandingProvider`, embedding pipeline, BullMQ ingestion worker, hybrid scoring logic. Voice is only a new input method producing a text string.
- Follow the existing provider-interface pattern used for `QueryUnderstandingProvider` when building the STT layer (i.e. define an interface, implement a local provider against it).

Execute the steps below in order. After each phase, run the listed verification command/check before moving to the next phase. If a step fails, stop and report the failure rather than proceeding.

**Status: Phase 1 is already complete on this machine.** `nodejs-whisper`, `fluent-ffmpeg`, and `@types/fluent-ffmpeg` are installed; `ffmpeg` is confirmed working on the system; the `base.en` model has been downloaded. Do not re-run Phase 1 — verify the items below are actually present, then start at Phase 2.

Quick verification before proceeding:
```bash
ls node_modules/nodejs-whisper
find node_modules/nodejs-whisper -iname "*base.en*"
ffmpeg -version
```
If any of these fail, stop and report before continuing — do not attempt to fix by re-running installs without investigating first.

---

## Phase 1 — Install dependencies (reference only — already done, do not re-run)

1. Run:
   ```bash
   npm install nodejs-whisper
   npm install fluent-ffmpeg
   npm install --save-dev @types/fluent-ffmpeg
   ```
2. Confirm `ffmpeg` binary is available on the system (`ffmpeg -version`). If not present, install it via the system package manager before continuing.
3. Run the model download step:
   ```bash
   npx nodejs-whisper download
   ```
   Select `base.en` when prompted.
4. **Verify:** confirm `node_modules/nodejs-whisper` exists and the model file was downloaded (check the path the CLI reports on completion).

---

## Phase 2 — Create the STT provider interface

Create `lib/stt/types.ts`:
```ts
export interface SpeechToTextProvider {
  transcribe(audioFilePath: string): Promise<{ text: string }>;
}
```

Create `lib/stt/localWhisperProvider.ts`:
```ts
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
```

Create `lib/stt/index.ts`:
```ts
import { LocalWhisperProvider } from "./localWhisperProvider";
import type { SpeechToTextProvider } from "./types";

export const sttProvider: SpeechToTextProvider = new LocalWhisperProvider();
```

**Verify:** `npx tsc --noEmit` passes with no errors in these three files.

---

## Phase 3 — Create the audio conversion helper

Create `lib/stt/convertToWav.ts`:
```ts
import ffmpeg from "fluent-ffmpeg";

export function convertToWav(inputPath: string, outputPath: string): Promise<void> {
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
```

**Verify:** file compiles with no type errors.

---

## Phase 4 — Create the transcribe API route

Create `app/api/transcribe/route.ts`:
```ts
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
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(wavPath).catch(() => {});
  }
}
```

**Verify:** with the dev server running, test the route directly:
```bash
curl -X POST -F "audio=@test.webm" http://localhost:3000/api/transcribe
```
Confirm it returns `{ "text": "..." }`. If you don't have a `test.webm` sample, record one from the browser first (Phase 5) and use that.

---

## Phase 5 — Add mic capture to the search UI

Locate the existing search input component (the one that currently submits typed queries to `/api/search`). Do not create a new/parallel search flow — add to the existing component.

Add state and handlers:
```ts
const [recording, setRecording] = useState(false);
const [transcribing, setTranscribing] = useState(false);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const chunksRef = useRef<Blob[]>([]);

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  chunksRef.current = [];
  recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
  recorder.onstop = handleRecordingStop;
  recorder.start();
  mediaRecorderRef.current = recorder;
  setRecording(true);
}

function stopRecording() {
  mediaRecorderRef.current?.stop();
  setRecording(false);
}

async function handleRecordingStop() {
  const blob = new Blob(chunksRef.current, { type: "audio/webm" });
  const formData = new FormData();
  formData.append("audio", blob, "query.webm");

  setTranscribing(true);
  try {
    const res = await fetch("/api/transcribe", { method: "POST", body: formData });
    const data = await res.json();
    if (data.text) {
      setSearchQuery(data.text);   // reuse the existing search input state setter — do not create a new one
      handleSearch(data.text);     // reuse the existing search submit function — do not create a new one
    }
  } catch (err) {
    console.error("Voice search failed:", err);
  } finally {
    setTranscribing(false);
  }
}
```

Add a mic button to the JSX next to the existing search input:
```tsx
<button
  type="button"
  onClick={recording ? stopRecording : startRecording}
  aria-label={recording ? "Stop recording" : "Start voice search"}
  disabled={transcribing}
>
  {recording ? "● Stop" : transcribing ? "Transcribing..." : "🎤"}
</button>
```

Wrap `startRecording` in a try/catch to handle mic permission denial and show an inline error state to the user (do not fail silently).

**IMPORTANT:** Use the actual existing state setter and submit function names from the component you are editing — the names `setSearchQuery` / `handleSearch` above are placeholders. Locate and inspect the actual component first before writing this code.

---

## Phase 6 — End-to-end verification

Run these checks in order and report results for each:

1. `npm run build` completes with no errors.
2. Start the dev server. Confirm mic button renders next to the search input.
3. Click mic, speak a short query (e.g. "father figure character"), stop recording.
4. Confirm the transcribed text appears in the search input.
5. Confirm the search automatically fires and results render — using the existing hybrid scoring, unchanged.
6. Test failure paths and confirm graceful handling (no crash, visible error state):
   - Deny mic permission when prompted.
   - Stop recording immediately with near-zero audio captured.
7. Run at least 5 voice queries covering existing test archetypes (father figure, mafia boss, royal/prince) and compare transcribed text accuracy against the intended query. Report any consistent misrecognitions.

Do not mark this task complete until step 6 and 7 have been run against live output — do not report success based on code review alone.

---

## Out of scope for this task (do not implement)

- Cloud/API-based STT providers.
- Streaming/partial transcription.
- Audio preprocessing (silence trimming, normalization).
- Any changes to `QueryUnderstandingProvider`, embedding generation, BullMQ worker, or scoring logic.