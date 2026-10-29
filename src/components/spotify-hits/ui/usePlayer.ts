"use client";
// Playback for the open album. Plays public/spotify-hits/<slug>/audio.mp3 (the song's clip) when
// the track has one; without it, a clock runs for the clip's length so the disc, progress bar and
// lyrics work the same either way. `time()` is the exact position (for the lyrics, read every
// frame); `elapsed` the same, ten times a second (for the progress bar). The audio element is
// exposed for the visualizer to analyse.
import { useCallback, useEffect, useRef, useState } from "react";
import { clipMs, fileUrl, type Track } from "../data/tracks";

/** `onEnd` is called when the clip plays to its end (not when it is paused or stopped). */
export function usePlayer(track: Track, onEnd?: () => void) {
  const ended = useRef(onEnd);
  ended.current = onEnd;
  const audio = useRef<HTMLAudioElement | null>(null);
  const clock = useRef({ base: 0, at: 0 }); // simulated: elapsed at `at`
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(clipMs(track));
  const real = track.files.audio;

  const now = useCallback(() => {
    if (real && audio.current) return audio.current.currentTime * 1000;
    const c = clock.current;
    return playing ? c.base + performance.now() - c.at : c.base;
  }, [real, playing]);

  const pause = useCallback(() => {
    if (real) audio.current?.pause();
    else clock.current = { base: now(), at: performance.now() };
    setPlaying(false);
  }, [real, now]);

  const stop = useCallback(() => {
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = 0;
    }
    clock.current = { base: 0, at: performance.now() };
    setPlaying(false);
    setElapsed(0);
  }, []);

  const play = useCallback(() => {
    if (real) {
      const a = (audio.current ??= new Audio());
      const src = fileUrl(track, "audio.mp3");
      if (!a.src.endsWith(src)) {
        a.src = src;
        a.preload = "auto";
      }
      a.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      // from the start again if it had finished
      const base = clock.current.base >= clipMs(track) ? 0 : clock.current.base;
      clock.current = { base, at: performance.now() };
      setPlaying(true);
    }
  }, [real, track]);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  /** Jumps to `ms` into the clip, playing or paused (the clip is loaded first if it never played). */
  const seek = useCallback(
    (ms: number) => {
      const t = Math.min(Math.max(0, ms), Math.max(0, duration - 50));
      if (real) {
        const a = (audio.current ??= new Audio());
        const src = fileUrl(track, "audio.mp3");
        if (!a.src.endsWith(src)) {
          a.src = src;
          a.preload = "auto";
        }
        a.currentTime = t / 1000;
      } else clock.current = { base: t, at: performance.now() };
      setElapsed(t);
    },
    [real, track, duration],
  );

  // a new track starts from silence
  useEffect(() => {
    stop();
    setDuration(clipMs(track));
  }, [track, stop]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const meta = () => isFinite(a.duration) && setDuration(a.duration * 1000);
    const end = () => {
      setPlaying(false);
      ended.current?.();
    };
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("ended", end);
    return () => {
      a.removeEventListener("loadedmetadata", meta);
      a.removeEventListener("ended", end);
    };
  }, [playing]);

  // progress, ten times a second, while playing
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const t = now();
      if (!real && t >= duration) {
        clock.current = { base: duration, at: performance.now() };
        setElapsed(duration);
        setPlaying(false);
        ended.current?.();
        return;
      }
      setElapsed(t);
    }, 100);
    return () => clearInterval(id);
  }, [playing, now, real, duration]);

  useEffect(() => () => audio.current?.pause(), []);

  return { playing, elapsed, duration, play, pause, stop, toggle, seek, audio, time: now };
}
