// Sound effects hook for game events
// Uses Web Audio API for near-instant playback (~5ms latency vs ~100-300ms with HTMLAudioElement)
'use client';

import { useCallback, useEffect, useRef } from 'react';

export type SoundEvent =
  | 'dragon'
  | 'phoenix'
  | 'dog'
  | 'bomb'
  | 'tichu'
  | 'grandTichu'
  | 'blindGrandTichu'
  | 'chat'
  | 'yourTurn';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const SOUND_FILES: Record<SoundEvent, string> = {
  dragon: `${BASE_PATH}/sounds/dragon.mp3`,
  phoenix: `${BASE_PATH}/sounds/phoenix.mp3`,
  dog: `${BASE_PATH}/sounds/dog.mp3`,
  bomb: `${BASE_PATH}/sounds/bomb.mp3`,
  tichu: `${BASE_PATH}/sounds/tichu.mp3`,
  grandTichu: `${BASE_PATH}/sounds/grand-tichu.mp3`,
  blindGrandTichu: `${BASE_PATH}/sounds/blind-grand.mp3`,
  chat: `${BASE_PATH}/sounds/chat.mp3`,
  yourTurn: `${BASE_PATH}/sounds/your-turn.mp3`,
};

const STORAGE_KEY_MUTED = 'tichu_sound_muted';
const STORAGE_KEY_VOLUME = 'tichu_sound_volume';

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
}

function loadVolume(): number {
  if (typeof window === 'undefined') return 0.7;
  const stored = localStorage.getItem(STORAGE_KEY_VOLUME);
  if (stored !== null) {
    const v = parseFloat(stored);
    if (!isNaN(v) && v >= 0 && v <= 1) return v;
  }
  return 0.7;
}

/**
 * Pre-decodes and plays sound effects using Web Audio API for minimal latency.
 * Falls back to HTMLAudioElement if Web Audio API is unavailable.
 * Audio playback requires prior user interaction (autoplay policy) —
 * by the time game events fire, the user has already clicked.
 */
export function useSoundEffects() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Map<SoundEvent, AudioBuffer>>(new Map());
  const gainNodeRef = useRef<GainNode | null>(null);
  const mutedRef = useRef(loadMuted());
  const volumeRef = useRef(loadVolume());
  // Fallback for browsers without Web Audio API
  const fallbackPoolRef = useRef<Map<SoundEvent, HTMLAudioElement[]>>(new Map());
  const usingWebAudioRef = useRef(true);

  // Initialize Web Audio API context and pre-decode all sound files
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      // Fallback to HTMLAudioElement pool
      usingWebAudioRef.current = false;
      const pool = new Map<SoundEvent, HTMLAudioElement[]>();
      for (const [event, src] of Object.entries(SOUND_FILES) as [SoundEvent, string][]) {
        const instances = [new Audio(src), new Audio(src)];
        for (const audio of instances) {
          audio.preload = 'auto';
          audio.volume = volumeRef.current;
        }
        pool.set(event, instances);
      }
      fallbackPoolRef.current = pool;
      return;
    }

    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // Create a gain node for volume control
    const gainNode = ctx.createGain();
    gainNode.gain.value = volumeRef.current;
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    // Pre-fetch and decode all audio files into AudioBuffers
    for (const [event, src] of Object.entries(SOUND_FILES) as [SoundEvent, string][]) {
      fetch(src)
        .then(res => res.arrayBuffer())
        .then(arrayBuf => ctx.decodeAudioData(arrayBuf))
        .then(audioBuffer => {
          buffersRef.current.set(event, audioBuffer);
        })
        .catch(() => {
          // Silently ignore decode failures — sound just won't play
        });
    }

    return () => {
      ctx.close();
    };
  }, []);

  const playSound = useCallback((event: SoundEvent) => {
    if (mutedRef.current) return;

    // Web Audio API path — near-instant playback from pre-decoded buffer
    if (usingWebAudioRef.current) {
      const ctx = audioCtxRef.current;
      const buffer = buffersRef.current.get(event);
      const gainNode = gainNodeRef.current;
      if (!ctx || !buffer || !gainNode) return;

      // Resume context if suspended (autoplay policy — resolved by prior user interaction)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNode);
      source.start(0);
      return;
    }

    // HTMLAudioElement fallback
    const instances = fallbackPoolRef.current.get(event);
    if (!instances) return;
    const audio = instances.find(a => a.paused || a.ended) ?? instances[0];
    audio.volume = volumeRef.current;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const v = Math.max(0, Math.min(1, volume));
    volumeRef.current = v;
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
    // Update gain node for Web Audio API
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v;
    }
    // Update fallback pool if in use
    for (const instances of fallbackPoolRef.current.values()) {
      for (const audio of instances) {
        audio.volume = v;
      }
    }
  }, []);

  return {
    playSound,
    isMuted: () => mutedRef.current,
    getVolume: () => volumeRef.current,
    setMuted,
    setVolume,
  };
}
