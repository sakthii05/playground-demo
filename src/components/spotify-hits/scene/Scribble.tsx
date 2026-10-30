"use client";
// Two pen loops round the disc while it is hovered or turned, drawn the way the reference does it:
// a "line boil". About fourteen times a second each loop is redrawn by hand, a little differently:
// its bumps shift, its start creeps on round the disc, its size breathes. Each loop goes a little
// over one full turn, so the ends overlap and there is never a gap, and the stroke swells in the
// middle and tapers to a point at both ends, like a pen.
// Arriving, the loops draw themselves on from their start; leaving, they are wiped off from it.
// Built as flat ribbons (not GL lines) so the width can vary along the stroke.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { R } from "./live";

/**
 * The ink: Spotify's green, a step deeper than the UI green so the stroke reads as ink, not light.
 * Shared and kept, so its shader is compiled once (in the intro's warm-up), not on first hover.
 */
export const INK = new THREE.MeshBasicMaterial({ color: "#1db954", side: THREE.DoubleSide, toneMapped: false });
const N = 220; // points along a loop
const TICK = 1 / 14; // seconds between redraws
const WIDTH = R * 0.016; // widest part of the stroke
const HARMONICS = [2, 3, 4, 5, 7];

interface Hand {
  radius: number;
  amps: number[];
  phases: number[];
  start: number; // angle the pen starts at
  turns: number; // a little over one
  drift: number; // the pen ends a little further out (or in) than it starts
  squash: number;
  press: number; // phase of the pressure wobble along the stroke
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function newHand(radius: number, start: number): Hand {
  return {
    radius,
    amps: HARMONICS.map((k) => rand(0.004, 0.022) / Math.sqrt(k / 2)),
    phases: HARMONICS.map(() => rand(0, Math.PI * 2)),
    start,
    turns: rand(1.06, 1.18),
    drift: rand(-0.035, 0.045),
    squash: rand(0.97, 1.03),
    press: rand(0, Math.PI * 2),
  };
}

/** The next redraw: the same loop by the same hand, but not traced exactly. */
function nextHand(h: Hand, base: number): Hand {
  return {
    radius: base * rand(0.995, 1.012),
    amps: h.amps.map((a, i) => a * 0.55 + (rand(0.004, 0.022) / Math.sqrt(HARMONICS[i] / 2)) * 0.45),
    phases: h.phases.map((p) => p + rand(-0.5, 0.5)),
    start: h.start + rand(0.12, 0.32), // creeps on round the disc
    turns: h.turns * 0.6 + rand(1.06, 1.18) * 0.4,
    drift: h.drift * 0.5 + rand(-0.035, 0.045) * 0.5,
    squash: h.squash * 0.6 + rand(0.97, 1.03) * 0.4,
    press: h.press + rand(-0.4, 0.4),
  };
}

/** Writes one loop as a ribbon: two vertices per point, either side of the line. */
function trace(h: Hand, out: Float32Array) {
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const a = h.start + k * h.turns * Math.PI * 2;
    let r = h.radius * (1 + h.drift * k);
    HARMONICS.forEach((m, j) => (r += h.radius * h.amps[j] * Math.sin(m * a + h.phases[j])));
    pts.push([Math.cos(a) * r * h.squash, Math.sin(a) * r / h.squash]);
  }
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const [x, y] = pts[i];
    const [px, py] = pts[Math.max(0, i - 1)];
    const [nx, ny] = pts[Math.min(N - 1, i + 1)];
    let tx = nx - px;
    let ty = ny - py;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    // pen pressure: tapered ends, a fuller middle that comes and goes
    const taper = Math.min(1, k / 0.14) * Math.min(1, (1 - k) / 0.18);
    const w = (WIDTH / 2) * Math.sqrt(taper) * (0.72 + 0.28 * Math.sin(k * 9 + h.press));
    out.set([x - ty * w, y + tx * w, 0, x + ty * w, y - tx * w, 0], i * 6);
  }
}

function ribbon() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 6), 3));
  const idx: number[] = [];
  for (let i = 0; i < N - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setIndex(idx);
  return g;
}

const LOOPS = [
  { radius: R * 1.05, start: Math.PI * 0.75 },
  { radius: R * 1.09, start: Math.PI * 1.55 },
];
/** Draw-on and wipe speeds, in strokes a second. */
const DRAW = 1 / 0.55;
const WIPE = 1 / 0.4;

export function Scribble({ on }: { on: () => boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geos = useMemo(() => LOOPS.map(ribbon), []);
  const material = INK;
  const state = useRef({ hands: LOOPS.map((l) => newHand(l.radius, l.start)), clock: 0, head: 0, tail: 0 });
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = state.current;
    const wanted = on();
    if (wanted) {
      // arriving (or coming back mid-wipe): draw on from the start
      if (s.tail > 0) {
        s.head = 0;
        s.tail = 0;
      }
      s.head = Math.min(1, s.head + dt * DRAW);
    } else if (s.head > 0) {
      s.tail = Math.min(s.head, s.tail + dt * WIPE);
      if (s.tail >= s.head) s.head = s.tail = 0;
    }
    const shown = s.head > 0;
    meshes.current.forEach((m) => m && (m.visible = shown));
    if (!shown) {
      s.clock = TICK; // so the first frame shown is drawn straight away
      return;
    }

    s.clock += dt;
    const redraw = s.clock >= TICK;
    if (redraw) {
      s.clock %= TICK;
      s.hands = s.hands.map((h, i) => nextHand(h, LOOPS[i].radius));
    }
    // the second loop is a beat behind the first as they draw on
    geos.forEach((g, i) => {
      if (redraw || s.head < 1 || s.tail > 0) {
        if (redraw) {
          trace(s.hands[i], g.attributes.position.array as Float32Array);
          g.attributes.position.needsUpdate = true;
        }
        const head = Math.max(0, Math.min(1, s.head * 1.15 - i * 0.15));
        const tail = Math.max(0, Math.min(1, s.tail * 1.15 - i * 0.15));
        const from = Math.floor(tail * (N - 1));
        const to = Math.floor(head * (N - 1));
        g.setDrawRange(from * 6, Math.max(0, to - from) * 6);
      }
    });
  });

  return (
    <group position={[0, 0, 0.002]}>
      {geos.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          material={material}
          visible={false}
          frustumCulled={false}
          raycast={() => {}}
          ref={(m) => void (meshes.current[i] = m)}
        />
      ))}
    </group>
  );
}
