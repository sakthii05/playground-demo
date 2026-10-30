// The state the frame loop reads every frame, kept in a ref so the page does not re-render for it,
// plus the sizes every part is built from.
import type { MutableRefObject } from "react";

/**
 * A jewel case, built to the real one: 142 × 125 × 10.4 mm. Sizes are in scene units, the case
 * `S` (2) tall, so 1 mm is `MM`. Across, a 6 mm hinge strip on the left and a 136 mm panel; the
 * panel is centred on x = 0, so the disc is too.
 */
export const S = 2;
export const MM = S / 125;
export const CASE = { w: 142 * MM, h: 125 * MM, panel: 136 * MM, hinge: 6 * MM };
/** Heights off the back plate's inner face, front to back of a closed case. */
export const Z = {
  back: -1.2 * MM, // clear back plate, outer face
  inlay: 0.35 * MM, // paper back insert lies on the back plate, this thick
  tray: 4.8 * MM, // the clear tray's plate, underside…
  well: 5.15 * MM, // the floor of the round pocket the disc sits in…
  trayTop: 6 * MM, // …and the tray's top, round it
  wall: 7.5 * MM, // the base's walls stand this high
  rim: 7.6 * MM, // the lid's rim comes down to here, outside the walls
  book: 8.6 * MM, // booklet, clipped under the lid plate
  lid: 9 * MM, // lid plate, inner face…
  top: 10.4 * MM, // …and outer face
};
/**
 * Paper, sized to fill the case inside its walls: the booklet covers the whole lid between the hinge
 * strip and the rim; the back insert's panel (the image is spine | panel | spine) lies between the
 * base's walls, its spines folded up just inside them. `x` is each one's centre across.
 */
export const PAPER = {
  bookW: 134 * MM,
  bookH: 122 * MM,
  bookX: -0.5 * MM,
  inlayW: 137 * MM,
  inlayH: 118 * MM,
  inlayX: -3 * MM,
  spine: 6 * MM,
  thick: 0.35 * MM,
};
/** CD: 120 mm, thin. Radii below are fractions of R, from the real disc. */
export const R = 60 * MM;
export const H = 0.011;
export const DISC = {
  hole: 0.125, // 15 mm centre hole
  hub: 0.3, // clear plastic out to here
  stack: 0.28, // the raised stacking ring
  mirror: 0.38, // a bright band before the print starts
  print: 0.975, // printed label stops just short of the rim
};
/**
 * How far the open timeline raises the disc on its hub (just unclipped: it stays seated, so the hub
 * shows square in the hole), and the extra lift on hover.
 */
export const LIFT = 0.018;
export const POP = 0.04;
/** The pocket in the tray: a little wider than the disc, deep enough that the resting disc sits flush. */
export const WELL = R + 0.6 * MM;
/** Where the disc's centre sits in its pocket, resting. */
export const DISC_REST = Z.well + H / 2 + 0.003;
/** The hub the disc clips onto: just inside the hole, standing flush with the raised disc's top. */
export const HUB = { r: R * 0.118, top: DISC_REST + H / 2 + LIFT };
/** How long the sleeve stays back after the disc stops turning, so it does not bob in and out. */
export const HOLD = 0.9;

export type Mode = "browse" | "opening" | "open" | "closing";
export type CaseState = "closed" | "opening" | "open" | "closing";

export interface Live {
  /** Carousel position, unbounded: `target` steps by whole albums, `pos` eases after it. */
  pos: number;
  target: number;
  /** Whether an album has been brought to the front, and whether its cover is open. */
  mode: Mode;
  caseState: CaseState;
  /** 0 … 1 values the timelines (GSAP) drive; the frame loop only reads them. `flip` turns the case over. */
  anim: { fly: number; rise: number; hinge: number; lift: number; flip: number };
  /** Next / previous while an album is at the front: the old one leaves by `-dir`, the new one arrives from `dir`. */
  swap: { from: number; dir: number; t: number };
  /** Pointer over the centre cover, -1 … 1 across it. */
  hover: { on: boolean; x: number; y: number };
  /** The open album's disc: pointer state, its turn (with spin velocity for the drag's inertia), how high it sits off the tray, and how far the sleeve has backed away from it. */
  disc: { hover: boolean; drag: boolean; yaw: number; pitch: number; vYaw: number; spin: number; z: number; back: number };
  playing: boolean;
  /** Pointer across the page, -1 … 1, for the light to follow. */
  pointer: { x: number; y: number };
  /** Until this time (ms) the carousel is being steered directly (drag, trackpad) and follows tightly. */
  steer: number;
  /** For the intro's warm-up: albums whose front cover is on, and the album whose detail art is on. */
  fronts: Set<string>;
  detailReady: string | null;
  /** The intro: loading progress 0 … 1 for its ring (1 only once everything is loaded and warmed up). */
  intro: { target: number };
  /** Lyrics view on: the open lid's page goes blank for them. */
  lyrics: boolean;
  /** Where that page is on screen (CSS px), worked out every frame while the lid lies open. */
  page: { on: boolean; x: number; y: number; w: number; h: number };
  /** Where the logo sits in the top bar, in CSS px (its centre and size), for the ball to fly to. */
  logoSlot: { x: number; y: number; size: number } | null;
  open: () => void;
  toggleCase: () => void;
  turnOver: () => void;
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
