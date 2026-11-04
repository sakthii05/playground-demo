"use client";
// The lyrics, printed on the open lid's blank page and in time with the song, the way Spotify shows
// them: the line being sung is white, lines already sung stay a little stronger than lines to come,
// and the list glides up so the current line stays a third of the way down the page. A pause in the
// singing shows three breathing dots.
//
// It follows the page every frame (its place comes from the 3D scene) and reads the playback clock
// every frame, without re-rendering: React only redraws when the current line changes.
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { LyricLine } from "./lrc";
import type { LiveRef } from "../scene/live";
import { DISPLAY, cx } from "./tw";

/** Ink for the album's paper: deep and dark on light stock, warm off-white on dark (as in the print). */
function inkFor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.88; // the page stock is the album colour, a shade darker; the ink a lot darker still
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) * 0.88;
  if (lum > 0.62 * 255) return `rgb(${Math.round(r * (1 - k))}, ${Math.round(g * (1 - k))}, ${Math.round(b * (1 - k))})`;
  return "rgb(246, 241, 231)";
}

/** The line being sung at time `t` (seconds); -1 before the first. */
function lineAt(lines: LyricLine[], t: number) {
  let i = -1;
  for (let k = 0; k < lines.length && lines[k].t <= t; k++) i = k;
  return i;
}

/** The line being sung. */
const SUNG = "#ffffff";

interface Props {
  live: LiveRef;
  lines: LyricLine[];
  color: string;
  /** Playback position in milliseconds. */
  time: () => number;
}

export function Lyrics({ live, lines, color, time }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(-1);
  const currentRef = useRef(-1);
  const ink = inkFor(color);

  useEffect(() => {
    let raf = 0;
    let last = { x: -1, y: -1, w: -1, h: -1 };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = box.current;
      const page = live.current.page;
      if (!el) return;
      el.style.visibility = page.on ? "visible" : "hidden";
      if (!page.on) return;
      // follow the page (only touching the style when it has moved)
      if (Math.abs(page.x - last.x) + Math.abs(page.y - last.y) + Math.abs(page.w - last.w) + Math.abs(page.h - last.h) > 0.5) {
        last = { ...page };
        el.style.transform = `translate(${page.x}px, ${page.y}px)`;
        el.style.width = `${page.w}px`;
        el.style.height = `${page.h}px`;
        el.style.setProperty("--fs", `${Math.max(12, Math.min(page.w, page.h) * 0.068)}px`);
      }
      const i = lineAt(lines, time() / 1000);
      if (i !== currentRef.current) {
        currentRef.current = i;
        setCurrent(i);
      }
      const row = list.current?.children[Math.max(0, i)] as HTMLElement | undefined;
      // keep the current line a third of the way down
      if (row && list.current) list.current.style.transform = `translateY(${page.h * 0.33 - row.offsetTop}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live, lines, time]);

  return (
    <motion.div
      ref={box}
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="pointer-events-none absolute left-0 top-0 overflow-hidden"
      style={{
        visibility: "hidden",
        // soft edges top and bottom, so lines fade in and out of the page rather than being cut
        maskImage: "linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 16%, #000 84%, transparent 100%)",
      }}
    >
      <div ref={list} className="px-[9%] transition-transform duration-650 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ fontSize: "var(--fs)" }}>
        {lines.map((line, k) => {
          const now = k === current;
          const done = k < current;
          if (!line.text)
            return (
              <div key={k} className="flex h-[1.6em] items-center gap-[0.35em] pl-[0.1em]" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className={cx("size-[0.28em] rounded-full transition-opacity", now ? "animate-pulse" : "")}
                    style={{ background: now ? SUNG : ink, opacity: now ? 0.85 : 0.2, animationDelay: `${d * 160}ms` }}
                  />
                ))}
              </div>
            );
          return (
            <p
              key={k}
              className={cx(DISPLAY, "mb-[0.42em] font-extrabold leading-[1.12] tracking-[-0.02em]")}
              style={now ? { color: SUNG } : { color: ink, opacity: done ? 0.5 : 0.3 }}
            >
              {line.text}
            </p>
          );
        })}
      </div>
    </motion.div>
  );
}
