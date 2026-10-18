"use client";
// A small Task Manager–style graph: light grid, a soft fill under one line, newest sample on the right.
import { useEffect, useRef } from "react";

export const TONES = {
  cpu: { line: "#1a7fc4", fill: "rgba(26,127,196,0.12)", grid: "rgba(26,127,196,0.14)" },
  gpu: { line: "#3f9a2a", fill: "rgba(63,154,42,0.12)", grid: "rgba(63,154,42,0.14)" },
  mem: { line: "#8b2fb0", fill: "rgba(139,47,176,0.11)", grid: "rgba(139,47,176,0.13)" },
  fps: { line: "#c2700f", fill: "rgba(194,112,15,0.12)", grid: "rgba(194,112,15,0.14)" },
} as const;
export type Tone = keyof typeof TONES;

export function Graph({ data, max, tone, points = 60 }: { data: number[]; max: number; tone: Tone; points?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const t = TONES[tone];
    g.strokeStyle = t.grid;
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = Math.round((h * i) / 4) + 0.5;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const x = Math.round((w * i) / 6) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    const tail = data.slice(-points);
    if (tail.length > 1) {
      const step = w / (points - 1);
      const x0 = w - (tail.length - 1) * step;
      const y = (v: number) => h - 1 - (Math.max(0, Math.min(max, v)) / max) * (h - 3);
      g.beginPath();
      tail.forEach((v, i) => (i ? g.lineTo(x0 + i * step, y(v)) : g.moveTo(x0, y(v))));
      g.lineTo(w, h);
      g.lineTo(x0, h);
      g.closePath();
      g.fillStyle = t.fill;
      g.fill();
      g.beginPath();
      tail.forEach((v, i) => (i ? g.lineTo(x0 + i * step, y(v)) : g.moveTo(x0, y(v))));
      g.strokeStyle = t.line;
      g.lineWidth = 1.4;
      g.lineJoin = "round";
      g.stroke();
    }
    g.strokeStyle = t.grid;
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
  }, [data, max, tone, points]);
  return <canvas ref={ref} className="block h-14 w-full rounded-md bg-white" aria-hidden />;
}
