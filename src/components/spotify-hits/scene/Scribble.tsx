"use client";
// Two loose pen loops round the disc while it is hovered or turned, as in the reference: each draws
// itself on from the top left, then wipes away from where it started and draws again. Letting go
// wipes them off. Done with a dash the length of the whole line, slid along it.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Line2 } from "three-stdlib";
import { R } from "./live";

interface Loop {
  points: [number, number, number][];
  length: number;
}

/** One hand-drawn loop: a little over a full turn, its radius wandering and the centre off true. */
function loop(seed: number, radius: number, turns: number, start: number): Loop {
  const pts: [number, number, number][] = [];
  const N = 240;
  const cx = Math.sin(seed * 3.1) * 0.025 * R;
  const cy = Math.cos(seed * 1.7) * 0.03 * R;
  let length = 0;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const a = start + k * turns * Math.PI * 2;
    // the pen drifts outward a little as it goes round, and wobbles
    const r = radius * (1 + 0.035 * k + 0.018 * Math.sin(a * 2 + seed) + 0.009 * Math.sin(a * 5 + seed * 2));
    const p: [number, number, number] = [cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 0.98, 0];
    if (i) length += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    pts.push(p);
  }
  return { points: pts, length };
}

const LOOPS = [loop(1, R * 1.06, 1.12, Math.PI * 0.8), loop(2.4, R * 1.1, 1.06, Math.PI * 0.95)];
const DRAW = 0.9; // seconds to draw a loop on
const HOLD = 0.5;
const WIPE = 0.8;

export function Scribble({ on }: { on: () => boolean }) {
  const refs = useRef<(Line2 | null)[]>([]);
  const t = useRef({ phase: 0, active: false });

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = t.current;
    const wanted = on();
    if (wanted) s.active = true;
    if (!s.active) return;
    const cycle = DRAW + HOLD + WIPE;
    if (wanted) s.phase = (s.phase + dt) % cycle;
    else {
      // let go: jump to the wipe and run it out fast
      if (s.phase < DRAW + HOLD) s.phase = DRAW + HOLD + WIPE * (1 - Math.min(1, s.phase / DRAW));
      s.phase += dt * 2;
      if (s.phase >= cycle) {
        s.phase = 0;
        s.active = false;
      }
    }
    LOOPS.forEach((l, i) => {
      const line = refs.current[i];
      if (!line) return;
      // the second loop runs a beat behind the first
      const p = Math.max(0, s.phase - i * 0.18);
      const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 2.2);
      const head = s.active ? ease(p / DRAW) : 0;
      const tail = s.active ? ease((p - DRAW - HOLD) / WIPE) : 0;
      const m = line.material;
      const shown = Math.max(0, head - tail);
      line.visible = shown > 0.002;
      // show only [tail, head] of the line: a dash that long, starting at tail
      m.dashSize = Math.max(1e-4, shown * l.length);
      m.gapSize = l.length * 2;
      m.dashOffset = -tail * l.length;
    });
  });

  return (
    // (Line hands its other props to the material too, so visibility and picking are set on the object)
    <group>
      {LOOPS.map((l, i) => (
        <Line
          key={i}
          ref={(r) => {
            const line = r as unknown as Line2 | null;
            refs.current[i] = line;
            if (line) {
              line.raycast = () => {};
              line.visible = false;
            }
          }}
          points={l.points}
          color="#ffffff"
          lineWidth={1.4}
          transparent
          opacity={0.85}
          dashed
          dashSize={0.0001}
          gapSize={l.length * 2}
        />
      ))}
    </group>
  );
}
