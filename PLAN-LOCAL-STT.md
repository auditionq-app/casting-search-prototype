# Task: Add Voice Search to casting-search-prototype (Web Speech API)

## Context (read before starting)

- Project: `casting-search-prototype`, Next.js 16 App Router, TypeScript, Prisma 7.
- An existing hybrid semantic search pipeline is already working: `/api/search` route accepts a text query, runs it through a `QueryUnderstandingProvider` (Qwen2.5 local), then hybrid scoring (vector + lexical + softMatch) against pgvector.
- Goal: add a mic button to the search UI that uses the browser's native `SpeechRecognition` API (Web Speech API) to convert speech to text, and feeds that text into the exact same search flow already used for typed queries.
- **This approach uses ZERO backend infrastructure.** No STT model, no npm package for transcription, no ffmpeg, no server-side processing of audio. Speech recognition runs entirely in the browser (Chrome/Edge). This replaces any earlier whisper/nodejs-whisper-based plan — do not install `nodejs-whisper` or `fluent-ffmpeg` for this task.
- Do NOT modify: `QueryUnderstandingProvider`, embedding pipeline, BullMQ ingestion worker, hybrid scoring logic. Voice is only a new input method producing a text string — "understanding" stops at getting the transcript; all query meaning (roles, age, city, etc.) is handled downstream by the existing text pipeline, unchanged.
- Browser support is Chrome/Edge only (they implement `SpeechRecognition` / `webkitSpeechRecognition`). Firefox/Safari do not support this API — unsupported browsers must get a clear inline message, not a silent failure or crash.

Execute the steps below in order. After each phase, run the listed verification check before moving to the next phase. If a step fails, stop and report the failure rather than proceeding.

---

## Phase 1 — Add TypeScript types for the Web Speech API

The `SpeechRecognition` API is not included in default TypeScript DOM types. Add a type declaration file.

Create `types/speech-recognition.d.ts`:
```ts
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface Window {
  SpeechRecognition: new () => SpeechRecognition;
  webkitSpeechRecognition: new () => SpeechRecognition;
}
```

**Verify:** `npx tsc --noEmit` runs with no new errors related to `SpeechRecognition`.

---

## Phase 2 — Create the shared `useVoiceSearch` hook

Create `frontend/src/components/search/useVoiceSearch.ts` (adjust the path to match this project's actual component directory structure if it differs — inspect the existing search component's location first and mirror it).

```ts
import { useRef, useState, useCallback } from "react";

interface UseVoiceSearchOptions {
  onResult: (transcript: string) => void;
  lang?: string;
}

interface UseVoiceSearchReturn {
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
}

export function useVoiceSearch({
  onResult,
  lang = "en-US",
}: UseVoiceSearchOptions): UseVoiceSearchReturn {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Voice search isn't supported in this browser. Please use Chrome or Edge.");
      return;
    }

    setError(null);

    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionImpl();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setError("Microphone permission denied. Please allow mic access to use voice search.");
      } else if (event.error === "no-speech") {
        setError("No speech detected. Try again.");
      } else {
        setError("Voice search failed. Please try again.");
      }
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, lang, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, isSupported, error, startListening, stopListening };
}
```

**Verify:** file compiles with no type errors (`npx tsc --noEmit`).

---

## Phase 3 — Wire the hook into the existing search component

1. Locate the existing search input component that currently submits typed queries to `/api/search`. Do not create a new/parallel search flow.
2. Import and use the hook:
   ```ts
   import { useVoiceSearch } from "@/components/search/useVoiceSearch"; // adjust import path to match actual location

   // inside the component:
   const { isListening, isSupported, error, startListening, stopListening } = useVoiceSearch({
     onResult: (transcript) => {
       setSearchQuery(transcript);   // use the actual existing state setter — inspect the component first
       handleSearch(transcript);     // use the actual existing search submit function — inspect the component first
     },
   });
   ```
3. Add a mic button to the JSX, next to the existing search input:
   ```tsx
   <button
     type="button"
     onClick={isListening ? stopListening : startListening}
     aria-label={isListening ? "Stop voice search" : "Start voice search"}
     disabled={!isSupported}
     title={!isSupported ? "Voice search requires Chrome or Edge" : undefined}
   >
     {isListening ? "● Listening..." : "🎤"}
   </button>
   {error && <span role="alert">{error}</span>}
   ```
4. **IMPORTANT:** Use the actual existing state setter and submit function names from the real component — `setSearchQuery` / `handleSearch` above are placeholders. Inspect the component before writing this code.
5. If this project has multiple search entry points (e.g. a general search bar and a separate director/talent search — mirror the "UniversalSearch" + "HeroSearch" split described in context), wire the hook into each one individually rather than trying to share state across them. Reuse the same hook, but call it separately per component.

**Verify:** `npm run build` completes with no errors.

---

## Phase 4 — Unsupported browser / permission handling

1. Confirm the mic button is visibly disabled (not just non-functional) in browsers where `isSupported` is `false`, with the tooltip/title explaining why.
2. Confirm denying microphone permission produces the inline error message from Phase 2's `onerror` handler — not a console-only error or silent failure.
3. Confirm `no-speech` (user clicks mic, says nothing, recognition times out) shows a clear "no speech detected" message and resets the button to its idle state.

**Verify:** manually test all three cases in Chrome — deny permission once, then allow it, then test one silent recording.

---

## Phase 5 — End-to-end verification

Run these checks in order and report results for each:

1. `npm run build` completes with no errors.
2. Open the app in Chrome. Confirm the mic button renders next to the search input(s).
3. Click mic, speak a short query (e.g. "father figure character"), confirm it auto-stops after the utterance.
4. Confirm the transcribed text appears in the search input.
5. Confirm the search automatically fires and results render — using the existing hybrid scoring, unchanged.
6. Repeat in Edge to confirm cross-browser consistency.
7. Open in Firefox or Safari (if available) and confirm the mic button shows as unsupported with a clear message, rather than throwing an error.
8. Run at least 5 voice queries covering existing test archetypes (father figure, mafia boss, royal/prince) and compare transcribed text accuracy against the intended query. Report any consistent misrecognitions.

Do not mark this task complete until steps 3–8 have been run against live output in an actual browser — do not report success based on code review alone.

---

## Out of scope for this task (do not implement)

- Any local or cloud STT model (whisper, nodejs-whisper, Groq, OpenAI Whisper API, etc.) — this task is browser-native only.
- Any backend audio processing, file upload, or ffmpeg conversion — there is no audio file; the browser returns text directly.
- Continuous/streaming recognition (`continuous: true`, `interimResults: true`) — this task uses single-utterance, final-result-only recognition as specified.
- Non-English language support beyond `en-US`.
- Any changes to `QueryUnderstandingProvider`, embedding generation, BullMQ worker, or scoring logic.

---

## Note on privacy

Chrome's implementation of the Web Speech API sends captured audio to Google's servers for processing — recognition is not fully local. This is a known tradeoff of this approach versus a local model like whisper. If a hard "audio never leaves our infra" requirement emerges later, this approach would need to be revisited in favor of a local STT pipeline. Not a blocker for this task, but worth surfacing if it comes up during review.