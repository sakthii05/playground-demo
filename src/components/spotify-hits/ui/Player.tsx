"use client";
// The player bar under the open album: previous, play / pause, next, and progress.
import { motion } from "motion/react";
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
}

export function Player({ track, playing, elapsed, duration, busy, onToggle, onSkip }: Props) {
  const p = Math.min(1, elapsed / duration);
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
        <div className="size-11 shrink-0 rounded-md sm:size-12" style={{ background: track.color }} aria-hidden />
        <div className={cx(SANS, "min-w-0 flex-1")}>
          <p className="truncate text-[15px] font-semibold">{track.title}</p>
          <p className="truncate text-[13px]" style={{ color: C.subdued }}>
            {artistLine(track)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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
      <div className={cx(MONO, "mt-3 flex items-center gap-3 text-[11px]")} style={{ color: C.subdued }}>
        <span className="w-9 text-right">{formatTime(elapsed)}</span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label="Progress">
          <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${p * 100}%` }} />
        </div>
        <span className="w-9">{formatTime(duration)}</span>
      </div>
    </motion.div>
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
