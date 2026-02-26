import { useState, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';

function hashKey(text: string, voice?: string): string {
  // Simple hash for cache key — deterministic, fast
  let hash = 0;
  const str = `tts:${voice || 'default'}:${text}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `tts:${hash.toString(36)}`;
}

/**
 * TTS hook with IndexedDB caching.
 * Audio is fetched from the backend and cached locally to avoid re-synthesizing.
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const isSupported = true;

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const playBuffer = useCallback((buffer: ArrayBuffer, messageId?: string) => {
    const blob = new Blob([buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => {
      setIsSpeaking(false);
      setSpeakingId(null);
      cleanup();
    };

    audio.onerror = () => {
      setIsSpeaking(false);
      setSpeakingId(null);
      cleanup();
    };

    setIsSpeaking(true);
    setSpeakingId(messageId ?? null);
    return audio.play();
  }, [cleanup]);

  const speak = useCallback(async (text: string, messageId?: string, voice?: string) => {
    cleanup();

    const cacheKey = hashKey(text, voice);

    try {
      // Check cache first
      const cached = await getCached<number[]>(cacheKey);
      if (cached) {
        const buffer = new Uint8Array(cached.data).buffer;
        await playBuffer(buffer, messageId);
        return;
      }

      // Fetch from API
      setIsSpeaking(true);
      setSpeakingId(messageId ?? null);

      const buffer = await api.synthesizeSpeech(text, voice);

      // Cache the audio as a number array (serializable for IndexedDB)
      const uint8 = new Uint8Array(buffer);
      setCache(cacheKey, Array.from(uint8));

      await playBuffer(buffer, messageId);
    } catch {
      setIsSpeaking(false);
      setSpeakingId(null);
      cleanup();
    }
  }, [cleanup, playBuffer]);

  const stop = useCallback(() => {
    cleanup();
    setIsSpeaking(false);
    setSpeakingId(null);
  }, [cleanup]);

  return {
    isSpeaking,
    speakingId,
    isSupported,
    speak,
    stop,
  };
}
