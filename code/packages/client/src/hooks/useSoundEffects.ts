// Sound effects hook for game events
// Plays audio cues for: Dragon, Phoenix, Dog, Bomb, Tichu, Grand Tichu, Chat
'use client';

import { useCallback, useEffect, useRef } from 'react';

export type SoundEvent =
  | 'dragon'
  | 'phoenix'
  | 'dog'
  | 'bomb'
  | 'tichu'
  | 'grandTichu'
  | 'chat';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

const SOUND_FILES: Record<SoundEvent, string> = {
  dragon: `${BASE_PATH}/sounds/dragon.mp3`,
  phoenix: `${BASE_PATH}/sounds/phoenix.mp3`,
  dog: `${BASE_PATH}/sounds/dog.mp3`,
  bomb: `${BASE_PATH}/sounds/bomb.mp3`,
  tichu: `${BASE_PATH}/sounds/tichu.mp3`,
  grandTichu: `${BASE_PATH}/sounds/grand-tichu.mp3`,
  chat: `${BASE_PATH}/sounds/chat.mp3`,
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
 * Pre-loads and plays sound effects for game events.
 * Uses HTMLAudioElement for simplicity and broad compatibility.
 * Audio playback requires prior user interaction (autoplay policy) —
 * by the time game events fire, the user has already clicked.
 */
export function useSoundEffects() {
  const audioPoolRef = useRef<Map<SoundEvent, HTMLAudioElement[]>>(new Map());
  const mutedRef = useRef(loadMuted());
  const volumeRef = useRef(loadVolume());

  // Pre-load audio files on mount
  useEffect(() => {
    const pool = new Map<SoundEvent, HTMLAudioElement[]>();
    for (const [event, src] of Object.entries(SOUND_FILES) as [SoundEvent, string][]) {
      // Create 2 instances per sound to handle rapid re-triggers
      const instances = [new Audio(src), new Audio(src)];
      for (const audio of instances) {
        audio.preload = 'auto';
        audio.volume = volumeRef.current;
      }
      pool.set(event, instances);
    }
    audioPoolRef.current = pool;
  }, []);

  const playSound = useCallback((event: SoundEvent) => {
    if (mutedRef.current) return;
    const instances = audioPoolRef.current.get(event);
    if (!instances) return;
    // Pick the first instance that isn't currently playing, or reset the first one
    const audio = instances.find(a => a.paused || a.ended) ?? instances[0];
    audio.volume = volumeRef.current;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked — user hasn't interacted yet. Silently ignore.
    });
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted;
    localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
  }, []);

  const setVolume = useCallback((volume: number) => {
    const v = Math.max(0, Math.min(1, volume));
    volumeRef.current = v;
    localStorage.setItem(STORAGE_KEY_VOLUME, String(v));
    // Update all pre-loaded audio instances
    for (const instances of audioPoolRef.current.values()) {
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
