import { useRef, useState, useCallback, useEffect } from "react";

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
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        setIsSupported(!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
    }, []);

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
            if (event.error === "not-allowed") {
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