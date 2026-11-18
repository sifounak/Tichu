// Sound effects hook for game events
// Uses Web Audio API for near-instant playback (~5ms latency vs ~100-300ms with HTMLAudioElement)
'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { UserPreferences } from '@tichu/shared';
import { usePreferencesStore } from '@/stores/preferencesStore';

export type SoundEvent =
  | 'dragon'
  | 'phoenix'
  | 'dog'
  | 'bomb'
  | 'tichu'
  | 'grandTichu'
  | 'blindGrandTichu'
  | 'chat'
  | 'yourTurn'
  | 'timerCountdown'
  | 'timerOutOfTime';

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
  timerCountdown: `${BASE_PATH}/sounds/timer-countdown-beep.mp3`,
  timerOutOfTime: `${BASE_PATH}/sounds/timer-out-of-time.mp3`,
};

const PLAYBACK_VOLUME = 0.7;

/** REQ-F-UP07: One sound gate for both playback implementations. */
export function isSoundEnabled(event: SoundEvent, preferences: UserPreferences): boolean {
  if (!preferences.soundEnabled) return false;
  switch (event) {
    case 'yourTurn': return preferences.yourTurnSound;
    case 'timerCountdown':
    case 'timerOutOfTime': return preferences.timerWarningSound;
    case 'chat': return preferences.chatSound;
    default: return preferences.cardsAndWagersSound;
  }
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
          audio.volume = PLAYBACK_VOLUME;
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
    gainNode.gain.value = PLAYBACK_VOLUME;
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
    if (!isSoundEnabled(event, usePreferencesStore.getState().preferences)) return;

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
    audio.volume = PLAYBACK_VOLUME;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);

  return { playSound };
}
