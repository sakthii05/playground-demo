"use client";
// Synced lyrics from public/spotify-hits/<slug>/lyrics.lrc, lined up with the song's clip.
//
// The file is the full song's LRC as found: lines of "[mm:ss.xx]text" (several stamps on one line are
// fine), "# comments", an optional "[offset:ms]" (standard LRC: a positive value shows the lyrics
// that much sooner), and optionally word stamps inside a line ("<mm:ss.xx>word"), for a highlight
// that follows each word. Times are moved onto the clip (clip.start becomes 0) and only the lines
// heard in the clip are kept.
import { useEffect, useState } from "react";
import { clipMs, fileUrl, type Track } from "../data/tracks";

export interface LyricWord {
  /** Seconds into the clip. */
  t: number;
  text: string;
}
export interface LyricLine {
  /** Seconds into the clip; the line runs until the next one starts. */
  t: number;
  text: string;
  /** Per-word times, when the file has them. */
  words?: LyricWord[];
}

const STAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const WORD = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

const seconds = (m: string, s: string, f = "0") => Number(m) * 60 + Number(s) + Number(f) / 10 ** f.length;

export function parseLrc(text: string, clip: { start: number; end: number } | undefined, length: number): LyricLine[] {
  const offset = Number(/\[offset:\s*([+-]?\d+)\s*\]/i.exec(text)?.[1] ?? 0) / 1000;
  const shift = (t: number) => t - offset - (clip?.start ?? 0);
  const out: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trimStart().startsWith("#")) continue;
    const stamps = [...raw.matchAll(STAMP)];
    if (!stamps.length) continue;
    const body = raw.slice(stamps[stamps.length - 1].index! + stamps[stamps.length - 1][0].length);
    // word stamps, if any: each word starts at its stamp
    const parts = body.split(WORD);
    let words: LyricWord[] | undefined;
    if (parts.length > 1) {
      words = [];
      for (let i = 1; i + 3 < parts.length + 1; i += 4) {
        const w = (parts[i + 3] ?? "").trim();
        if (w) words.push({ t: shift(seconds(parts[i], parts[i + 1], parts[i + 2])), text: w });
      }
    }
    const clean = body.replace(WORD, "").replace(/\s+/g, " ").trim();
    for (const m of stamps) out.push({ t: shift(seconds(m[1], m[2], m[3])), text: clean, words });
  }
  out.sort((a, b) => a.t - b.t);
  // keep what is heard in the clip: lines that start inside it, plus the one already being sung as
  // it begins (shown from 0)
  const firstInside = out.findIndex((l) => l.t >= 0);
  const from = firstInside > 0 && out[firstInside - 1].text ? firstInside - 1 : Math.max(0, firstInside);
  const kept = out
    .slice(from)
    .filter((l) => l.t < length)
    .map((l) => ({ ...l, t: Math.max(0, l.t) }));
  // an instrumental opening gets the breathing dots until the singing starts
  if (kept.length && kept[0].t > 1.5 && kept[0].text) kept.unshift({ t: 0, text: "" });
  return kept;
}

/** The track's lyrics for its clip, or null while loading or when it has none. */
export function useLyrics(track: Track) {
  const [lines, setLines] = useState<LyricLine[] | null>(null);
  useEffect(() => {
    setLines(null);
    if (!track.files.lyrics) return;
    let alive = true;
    fetch(fileUrl(track, "lyrics.lrc"))
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => alive && setLines(parseLrc(text, track.clip, clipMs(track) / 1000)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [track]);
  return lines;
}
