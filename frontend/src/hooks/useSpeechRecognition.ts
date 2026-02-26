import { useState, useCallback, useRef } from 'react';

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

// Browser speech recognition constructor (webkit-prefixed in most browsers)
const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  // Track finalized text separately so interim results don't stack
  const finalizedRef = useRef('');

  const isSupported = !!SpeechRecognitionCtor;

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) return;

    // Stop any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    finalizedRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild the full transcript from all results every time
      let finalized = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalized += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      finalizedRef.current = finalized;
      // Show finalized text + current interim segment (no stacking)
      const full = (finalized + interim).trim();
      setTranscript(full);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // Use only finalized text when recognition ends
      if (finalizedRef.current) {
        setTranscript(finalizedRef.current.trim());
      }
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    // Settle on finalized text
    if (finalizedRef.current) {
      setTranscript(finalizedRef.current.trim());
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalizedRef.current = '';
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
