"use client";
// Playback for the open album. Plays public/spotify-hits/<slug>/audio.mp3 when the track has one;
// without it, a clock runs for the track's length so the disc, progress bar and (later) lyrics work
// the same either way. The audio element is exposed for the visualizer to analyse.
import { useCallback, useEffect, useRef, useState } from "react";
import { fileUrl, type Track } from "../data/tracks";

export function usePlayer(track: Track) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const clock = useRef({ base: 0, at: 0 }); // simulated: elapsed at `at`
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(track.durationMs);
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
      const base = clock.current.base >= track.durationMs ? 0 : clock.current.base;
      clock.current = { base, at: performance.now() };
      setPlaying(true);
    }
  }, [real, track]);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  // a new track starts from silence
  useEffect(() => {
    stop();
    setDuration(track.durationMs);
  }, [track, stop]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const meta = () => isFinite(a.duration) && setDuration(a.duration * 1000);
    const end = () => setPlaying(false);
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
        return;
      }
      setElapsed(t);
    }, 100);
    return () => clearInterval(id);
  }, [playing, now, real, duration]);

  useEffect(() => () => audio.current?.pause(), []);

  return { playing, elapsed, duration, play, pause, stop, toggle, audio };
}
