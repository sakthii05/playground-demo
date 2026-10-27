// The state the frame loop reads every frame, kept in a ref so the page does not re-render for it,
// plus the sizes every part is built from.
import type { MutableRefObject } from "react";

/**
 * Digipak, in the proportions of a real one (about 140 mm square, 2 mm board): a tray panel and a
 * front cover `S` wide and `T` thick, joined by a spine `SPINE` deep that leaves room for the disc.
 */
export const S = 2;
export const T = 0.03;
export const CORNER = 0.035;
export const SPINE = 0.1;
/** CD: 120 mm, 1.2 mm thick. Radii below are fractions of R, from the real disc. */
export const R = S * 0.43;
export const H = 0.018;
export const DISC = {
  hole: 0.125, // 15 mm centre hole
  hub: 0.3, // clear plastic out to here
  stack: 0.28, // the raised stacking ring
  mirror: 0.38, // a bright band before the print starts
  print: 0.975, // printed label stops just short of the rim
};
/** How far the open timeline lifts the disc out of the tray, and the extra lift on hover. */
export const LIFT = 0.3;
export const POP = 0.1;

export type Mode = "browse" | "opening" | "open" | "closing";
export type CaseState = "closed" | "opening" | "open" | "closing";

export interface Live {
  /** Carousel position, unbounded: `target` steps by whole albums, `pos` eases after it. */
  pos: number;
  target: number;
  /** Whether an album has been brought to the front, and whether its cover is open. */
  mode: Mode;
  caseState: CaseState;
  /** 0 … 1 values the timelines (GSAP) drive; the frame loop only reads them. */
  anim: { fly: number; rise: number; hinge: number; lift: number };
  /** Next / previous while an album is at the front: the old one leaves by `-dir`, the new one arrives from `dir`. */
  swap: { from: number; dir: number; t: number };
  /** Pointer over the centre cover, -1 … 1 across it. */
  hover: { on: boolean; x: number; y: number };
  /** The open album's disc: pointer state, its turn (with spin velocity for the drag's inertia), and how high it sits off the tray. */
  disc: { hover: boolean; drag: boolean; yaw: number; pitch: number; vYaw: number; spin: number; z: number };
  playing: boolean;
  /** Pointer across the page, -1 … 1, for the light to follow. */
  pointer: { x: number; y: number };
  open: () => void;
  toggleCase: () => void;
}

export type LiveRef = MutableRefObject<Live>;

export const wrap = (i: number, n: number) => ((i % n) + n) % n;
/** Offset of album `i` from the centre, in albums, in -n/2 … n/2. */
export const offsetOf = (i: number, pos: number, n: number) => wrap(i - pos + n / 2, n) - n / 2;
/** Linear lookup in a table sampled at 0, 1, 2 …, holding the last value past its end. */
export const lerpTable = (table: number[], a: number) => {
  const i = Math.min(Math.floor(a), table.length - 1);
  if (i >= table.length - 1) return table[table.length - 1];
  return table[i] + (table[i + 1] - table[i]) * (a - i);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => x * x * (3 - 2 * x);
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** True while the open album's disc is being turned or has not settled on a face yet. */
export const discBusy = (d: Live["disc"]) => {
  const off = Math.abs(d.yaw - Math.round(d.yaw / Math.PI) * Math.PI);
  return d.drag || Math.abs(d.vYaw) > 0.01 || off > 0.02 || Math.abs(d.pitch) > 0.02;
};
