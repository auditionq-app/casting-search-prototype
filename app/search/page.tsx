"use client";

import { useEffect, useRef, useState } from "react";

interface SearchResult {
  id: string;
  full_name: string;
  bio: string | null;
  primary_category: string | null;
  experience_level: string | null;
  location: string;
  finalScore: number;
  vectorScore: number;
  lexicalScore: number;
  softMatchScore: number;
}

interface SearchResponse {
  query: string;
  parsed: {
    hard_filters: Record<string, unknown>;
    soft_preferences: { traits?: string[] };
    semantic_query: string;
  };
  totalCandidates: number;
  page: number;
  pageSize: number;
  results: SearchResult[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function releaseMediaStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      releaseMediaStream();
    };
  }, []);

  async function search(queryText: string) {
    if (!queryText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed: ${res.status}`);
      }

      const json: SearchResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await search(query);
  }

  async function startRecording() {
    try {
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Voice recording is not supported by this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = handleRecordingStop;

      recorder.start();

      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error("Microphone access failed:", err);
      releaseMediaStream();

      setError(
        err instanceof Error && err.message.includes("not supported")
          ? err.message
          : "Microphone access was denied or unavailable. Please allow microphone access and try again."
      );

      setRecording(false);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function handleRecordingStop() {
    releaseMediaStream();

    const blob = new Blob(chunksRef.current, {
      type: "audio/webm",
    });

    if (blob.size === 0) {
      setError("No audio was recorded. Please try again.");
      return;
    }

    const formData = new FormData();
    formData.append("audio", blob, "query.webm");

    setTranscribing(true);
    setError(null);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(
          responseData.error ?? `Transcription failed: ${res.status}`
        );
      }

      if (!responseData.text?.trim()) {
        throw new Error("No speech was detected. Please try again.");
      }

      const transcribedText = responseData.text.trim();

      setQuery(transcribedText);
      await search(transcribedText);
    } catch (err) {
      console.error("Voice search failed:", err);

      setError(
        err instanceof Error ? err.message : "Voice search failed"
      );
    } finally {
      setTranscribing(false);
      mediaRecorderRef.current = null;
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
        Actor Search
      </h1>

      <form
        onSubmit={handleSearch}
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. A warm but authoritative father figure in his 50s"
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            border: "1px solid #ccc",
            borderRadius: 6,
            fontSize: "1rem",
          }}
        />

        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          aria-label={
            recording ? "Stop recording" : "Start voice search"
          }
          disabled={transcribing || loading}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fff",
            cursor:
              transcribing || loading ? "default" : "pointer",
            opacity: transcribing || loading ? 0.6 : 1,
          }}
        >
          {recording
            ? "● Stop"
            : transcribing
              ? "Transcribing..."
              : "🎤"}
        </button>

        <button
          type="submit"
          disabled={loading || transcribing}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: 6,
            border: "none",
            background: "#111",
            color: "#fff",
            cursor:
              loading || transcribing ? "default" : "pointer",
            opacity: loading || transcribing ? 0.6 : 1,
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {data && (
        <>
          <div
            style={{
              fontSize: "0.85rem",
              color: "#666",
              marginBottom: "1rem",
            }}
          >
            {data.totalCandidates} candidates after filters ·{" "}
            semantic query: &quot;{data.parsed.semantic_query}&quot;
            {data.parsed.soft_preferences.traits?.length ? (
              <>
                {" "}
                · traits:{" "}
                {data.parsed.soft_preferences.traits.join(", ")}
              </>
            ) : null}
          </div>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {data.results.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "1rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {r.full_name}
                </div>

                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "#333",
                  }}
                >
                  {[r.primary_category, r.experience_level, r.location]
                    .filter(Boolean)
                    .join(" · ")}
                </div>

                {r.bio && (
                  <div
                    style={{
                      fontSize: "0.9rem",
                      color: "#555",
                      marginTop: "0.25rem",
                    }}
                  >
                    {r.bio}
                  </div>
                )}

                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#999",
                    marginTop: "0.25rem",
                  }}
                >
                  final: {r.finalScore.toFixed(3)} (vector:{" "}
                  {r.vectorScore.toFixed(3)}, lexical:{" "}
                  {r.lexicalScore.toFixed(3)}, softMatch:{" "}
                  {r.softMatchScore.toFixed(3)})
                </div>
              </li>
            ))}
          </ul>

          {data.results.length === 0 && <p>No results found.</p>}
        </>
      )}
    </div>
  );
}