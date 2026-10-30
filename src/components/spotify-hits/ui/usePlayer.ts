"use client";
// Playback for the open album: public/spotify-hits/<slug>/audio.mp3, the song's clip. A song
// without one does not play at all (the player says so instead). `time()` is the exact position
// (for the lyrics, read every frame); `elapsed` the same, ten times a second (for the progress
// bar). The audio element is exposed for the visualizer to analyse.
import { useCallback, useEffect, useRef, useState } from "react";
import { clipMs, fileUrl, type Track } from "../data/tracks";

/** `onEnd` is called when the clip plays to its end (not when it is paused or stopped). */
export function usePlayer(track: Track, onEnd?: () => void) {
  const ended = useRef(onEnd);
  ended.current = onEnd;
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(clipMs(track));
  const real = track.files.audio;

  const now = useCallback(() => (real && audio.current ? audio.current.currentTime * 1000 : 0), [real]);

  const pause = useCallback(() => {
    audio.current?.pause();
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    if (audio.current) {
      audio.current.pause();
      audio.current.currentTime = 0;
    }
    setPlaying(false);
    setElapsed(0);
  }, []);

  /** The audio element, loaded with this track's clip. */
  const load = useCallback(() => {
    const a = (audio.current ??= new Audio());
    const src = fileUrl(track, "audio.mp3");
    if (!a.src.endsWith(src)) {
      a.src = src;
      a.preload = "auto";
    }
    return a;
  }, [track]);

  const play = useCallback(() => {
    if (!real) return;
    load().play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, [real, load]);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  /** Jumps to `ms` into the clip, playing or paused (the clip is loaded first if it never played). */
  const seek = useCallback(
    (ms: number) => {
      if (!real) return;
      const t = Math.min(Math.max(0, ms), Math.max(0, duration - 50));
      load().currentTime = t / 1000;
      setElapsed(t);
    },
    [real, load, duration],
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
    const id = setInterval(() => setElapsed(now()), 100);
    return () => clearInterval(id);
  }, [playing, now]);

  useEffect(() => () => audio.current?.pause(), []);

  return { playing, elapsed, duration, play, pause, stop, toggle, seek, audio, time: now };
}
