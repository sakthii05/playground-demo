"use client";
// The words round the carousel: the big title above the centre album, credits and streams below it.
// Each swaps with a short fade when the album changes.
import { AnimatePresence, motion } from "motion/react";
import { artistLine, formatStreams, type Track } from "../data/tracks";
import { C, DISPLAY, MONO, SANS, cx } from "./tw";

const swap = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } };

const names = (list: string[], max: number) => (list.length > max ? `${list.slice(0, max).join(", ")} +${list.length - max}` : list.join(", "));

export function TrackHeading({ track, hidden }: { track: Track; hidden: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[clamp(76px,12.5vh,132px)] px-4 text-center">
      <AnimatePresence mode="wait">
        {!hidden && (
          <motion.div key={track.slug} {...swap}>
            <h1 className={cx(DISPLAY, "mx-auto max-w-[18ch] text-balance font-extrabold leading-[0.92] tracking-[-0.035em] text-[clamp(2.1rem,6vw,5.25rem)]")}>{track.title}</h1>
            <p className={cx(SANS, "mt-2 text-[clamp(0.95rem,1.4vw,1.15rem)] font-medium")} style={{ color: C.subdued }}>
              {artistLine(track)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TrackMeta({ track, hidden, narrow }: { track: Track; hidden: boolean; narrow: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[clamp(44px,9.5vh,104px)] px-4">
      <AnimatePresence mode="wait">
        {!hidden && (
          <motion.div key={track.slug} {...swap} className="mx-auto flex max-w-[860px] flex-col items-center gap-3 text-center">
            <p className={cx(SANS, "line-clamp-2 max-w-[56ch] text-[13px] leading-snug sm:text-sm")} style={{ color: C.subdued }}>
              {track.blurb}
            </p>
            <dl className={cx(SANS, "grid w-full grid-cols-2 gap-x-6 gap-y-2 text-left text-[12px] sm:flex sm:justify-center sm:gap-x-10 sm:text-[13px]")}>
              <Fact label="Written by" value={names(track.writers, narrow ? 2 : 3)} />
              {!narrow && <Fact label="Produced by" value={names(track.producers, 2)} />}
              {!narrow && <Fact label="Album" value={`${track.album} · ${track.year}`} />}
              <Fact label={track.streamsEstimated ? "Streams (est.)" : "Streams"} value={formatStreams(track.streams)} mono />
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</dt>
      <dd className={cx("mt-0.5 truncate text-white/90 sm:max-w-[28ch]", mono && MONO)}>{value}</dd>
    </div>
  );
}
