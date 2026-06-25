import { useEffect, useRef, useCallback, useState } from 'react';

interface UseAudioOptions {
  /** Volume level from 0 to 1 */
  volume?: number;
  /** Whether to loop the audio */
  loop?: boolean;
  /** Whether to respect reduced motion preference (pause audio when reduced motion is enabled) */
  respectReducedMotion?: boolean;
}

/**
 * A hook for playing audio files with proper cleanup and controls.
 * 
 * @param src - Path to the audio file (can be a URL or imported asset)
 * @param options - Audio configuration options
 * @returns Object with play, pause, stop, and isPlaying controls
 * 
 * @example
 * ```tsx
 * const timerAudio = useAudio('/sounds/timer-music.mp3', { loop: true, volume: 0.5 });
 * 
 * useEffect(() => {
 *   if (isActive) {
 *     timerAudio.play();
 *   } else {
 *     timerAudio.stop();
 *   }
 * }, [isActive]);
 * ```
 */
export function useAudio(
  src: string | null,
  options: UseAudioOptions = {}
) {
  const { volume = 1, loop = false, respectReducedMotion = true } = options;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize audio element
  useEffect(() => {
    if (!src) return;

    const audio = new Audio(src);
    audio.volume = volume;
    audio.loop = loop;
    audioRef.current = audio;

    const handleCanPlayThrough = () => setIsLoaded(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  // Update volume when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Update loop when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = loop;
    }
  }, [loop]);

  // Check for reduced motion preference
  const prefersReducedMotion = respectReducedMotion && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const play = useCallback(async () => {
    if (!audioRef.current || prefersReducedMotion) return;
    
    try {
      // Reset to beginning if already played
      if (audioRef.current.ended) {
        audioRef.current.currentTime = 0;
      }
      await audioRef.current.play();
    } catch (error) {
      // Autoplay was prevented or other error
      console.warn('Audio playback failed:', error);
    }
  }, [prefersReducedMotion]);

  const pause = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  }, []);

  const stop = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, newVolume));
  }, []);

  return {
    play,
    pause,
    stop,
    setVolume,
    isPlaying,
    isLoaded,
    audio: audioRef.current,
  };
}
