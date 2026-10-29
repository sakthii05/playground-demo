"use client";
// The player bar under the open album: lyrics on / off, previous, play / pause, next, and progress.
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "motion/react";
import { TbMicrophone2 } from "react-icons/tb";
import { artistLine, formatTime, type Track } from "../data/tracks";
import { C, FOCUS, MONO, SANS, cx } from "./tw";

interface Props {
  track: Track;
  playing: boolean;
  elapsed: number;
  duration: number;
  busy: boolean;
  onToggle: () => void;
  onSkip: (dir: 1 | -1) => void;
  onSeek: (ms: number) => void;
  /** The album's front cover (its front.webp, or the drawn one), for the little picture. */
  cover: string | null;
  /** Lyrics: whether they are showing, whether this song has any, and the switch. */
  lyrics: boolean;
  hasLyrics: boolean;
  onLyrics: () => void;
}

export function Player({ track, playing, elapsed, duration, busy, onToggle, onSkip, onSeek, cover, lyrics, hasLyrics, onLyrics }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto absolute inset-x-0 bottom-[clamp(14px,3.5vh,36px)] mx-auto w-[min(680px,calc(100%-32px))] rounded-2xl border border-white/[0.06] p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-4"
      style={{ background: `${C.surface}d9` }}
    >
      <div className="flex items-center gap-3">
        <div className="size-11 shrink-0 overflow-hidden rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.4)] sm:size-12" style={{ background: track.color }} aria-hidden>
          {cover && (
            // a data URL or a small local file: next/image would add nothing here
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="size-full object-cover" draggable={false} />
          )}
        </div>
        <div className={cx(SANS, "min-w-0 flex-1")}>
          <p className="truncate text-[15px] font-semibold">{track.title}</p>
          <p className="truncate text-[13px]" style={{ color: C.subdued }}>
            {artistLine(track)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onLyrics}
            disabled={!hasLyrics}
            aria-pressed={lyrics}
            aria-label={hasLyrics ? (lyrics ? "Hide lyrics" : "Show lyrics") : "No lyrics for this song"}
            title={hasLyrics ? (lyrics ? "Hide lyrics" : "Show lyrics") : "No lyrics for this song"}
            className={cx(
              "relative grid size-9 cursor-pointer place-items-center rounded-full transition hover:scale-105 disabled:cursor-default disabled:opacity-35 disabled:hover:scale-100",
              lyrics ? "text-[#1ed760]" : "text-white/75 hover:text-white",
              FOCUS,
            )}
          >
            <TbMicrophone2 className="size-[18px]" aria-hidden />
            {/* Spotify marks an active toggle with a small dot under it */}
            {lyrics && <span className="absolute bottom-0.5 size-1 rounded-full bg-[#1ed760]" aria-hidden />}
          </button>
          <Skip dir={-1} disabled={busy} onClick={() => onSkip(-1)} />
          <button
            type="button"
            onClick={onToggle}
            aria-label={playing ? "Pause" : "Play"}
            className={cx("grid size-11 cursor-pointer place-items-center rounded-full text-black transition-transform hover:scale-105 active:scale-95", FOCUS)}
            style={{ background: C.green }}
          >
            {playing ? (
              <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
                <rect x="3" y="2" width="3.5" height="12" rx="1" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="ml-0.5 size-4" fill="currentColor" aria-hidden>
                <path d="M4 2.6v10.8a.8.8 0 0 0 1.2.7l9-5.4a.8.8 0 0 0 0-1.4l-9-5.4A.8.8 0 0 0 4 2.6Z" />
              </svg>
            )}
          </button>
          <Skip dir={1} disabled={busy} onClick={() => onSkip(1)} />
        </div>
      </div>
      <Seek elapsed={elapsed} duration={duration} onSeek={onSeek} />
    </motion.div>
  );
}

/**
 * The progress bar, Spotify's way: hovering turns the fill green and shows its thumb and the time
 * under the pointer; a click jumps there, a drag scrubs (the bar and the time follow the pointer,
 * and the song moves when it is let go). It is a slider too: arrows step 5 s, Home / End the ends.
 */
function Seek({ elapsed, duration, onSeek }: { elapsed: number; duration: number; onSeek: (ms: number) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const at = (e: PointerEvent) => {
    const b = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
  };
  const shown = drag ?? Math.min(1, elapsed / Math.max(1, duration));
  const tip = drag ?? hover;
  const key = (e: KeyboardEvent) => {
    const step = { ArrowRight: 5000, ArrowUp: 5000, ArrowLeft: -5000, ArrowDown: -5000 }[e.key];
    if (step) onSeek(elapsed + step);
    else if (e.key === "Home") onSeek(0);
    else if (e.key === "End") onSeek(duration);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <div className={cx(MONO, "mt-3 flex items-center gap-3 text-[11px]")} style={{ color: C.subdued }}>
      <span className="w-9 text-right">{formatTime(shown * duration)}</span>
      <div
        ref={bar}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round((shown * duration) / 1000)}
        aria-valuetext={`${formatTime(shown * duration)} of ${formatTime(duration)}`}
        onKeyDown={key}
        onPointerEnter={(e) => setHover(at(e))}
        onPointerMove={(e) => {
          setHover(at(e));
          if (drag !== null) setDrag(at(e));
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(at(e));
        }}
        onPointerUp={(e) => {
          if (drag === null) return;
          onSeek(at(e) * duration);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        className={cx("group relative flex h-4 flex-1 cursor-pointer touch-none items-center rounded-full", FOCUS)}
      >
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className={cx("absolute inset-y-0 left-0 rounded-full transition-colors", drag !== null ? "bg-[#1ed760]" : "bg-white group-hover:bg-[#1ed760]")}
            style={{ width: `${shown * 100}%` }}
          />
        </div>
        <span
          aria-hidden
          className={cx("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-opacity", drag !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100")}
          style={{ left: `${shown * 100}%` }}
        />
        {tip !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] text-white shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
            style={{ left: `${tip * 100}%`, background: C.raised }}
          >
            {formatTime(tip * duration)}
          </span>
        )}
      </div>
      <span className="w-9">{formatTime(duration)}</span>
    </div>
  );
}

function Skip({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? "Previous song" : "Next song"}
      className={cx("grid size-9 cursor-pointer place-items-center rounded-full text-white/75 transition hover:scale-105 hover:text-white disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100", FOCUS)}
    >
      <svg viewBox="0 0 16 16" className={cx("size-4", dir > 0 && "-scale-x-100")} fill="currentColor" aria-hidden>
        <rect x="2.5" y="2.5" width="2" height="11" rx="0.8" />
        <path d="M13.5 3.3v9.4a.7.7 0 0 1-1.1.6L5.6 8.6a.7.7 0 0 1 0-1.2l6.8-4.7a.7.7 0 0 1 1.1.6Z" />
      </svg>
    </button>
  );
}
