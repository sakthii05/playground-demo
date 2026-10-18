"use client";
// Shared materials, the live state the frame loop reads, and the small primitives every part is made of.
// Materials are deliberately plain (Lambert): the drawing comes from the geometry and its ink edges.
import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

export const INK = "#202124";

// Solid faces are pushed back a hair in depth so their ink edges never fight them (that fight shimmers as you orbit).
const lam = (color: string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra });
export const M = {
  white: lam("#f7f7f5"),
  shell: lam("#f1f1ee"),
  tray: lam("#e2e3e4"),
  soft: lam("#e6e6e2"),
  grey: lam("#c9cacc"),
  steel: lam("#b9bcc0"),
  slot: lam("#3a3c40"),
  dark: lam("#2b2d31"),
  black: lam("#1b1c1f"),
  rubber: lam("#4a4c50"),
  gpu: lam("#5f6369"),
  gpuEdge: lam("#6d7178"),
  fin: lam("#34363b"),
  copper: lam("#c98a5c"),
  gold: lam("#d6b46a"),
  board: lam("#ecece8"),
  pcb: lam("#2a6a40"),
  pcbEdge: lam("#1f5231"),
  alu: lam("#c4c8cd"),
  aluDark: lam("#a9aeb4"),
  shroudDark: lam("#3c3f45"),
  smd: lam("#2a2b2e"),
  ceramic: lam("#b9a27a"),
  pin: lam("#d8b45e"),
  chip: lam("#26272a"),
  boardLine: lam("#d9d9d4"),
  blade: lam("#fbfbfa", { side: THREE.DoubleSide }),
  bladeDark: lam("#2a2c30", { side: THREE.DoubleSide }),
  cable: lam("#f2f2ef"),
  glass: new THREE.MeshLambertMaterial({ color: "#cfe0e8", transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  blur: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  blurDark: new THREE.MeshBasicMaterial({ color: "#3a3c40", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  // lights: their colour is driven by the power level each frame
  led: new THREE.MeshBasicMaterial({ color: "#c9ccd0" }),
  ledSoft: new THREE.MeshBasicMaterial({ color: "#d9dbde" }),
  screenOff: new THREE.MeshBasicMaterial({ color: "#16171a" }),
};

// ---------- live state ----------
export interface Live {
  power: boolean; // what the user asked for
  level: number; // 0..1 eased power (fans, lights)
  apart: boolean;
  t: number; // 0..1 eased explode
  pinned?: boolean; // preview: hold t where the URL put it
  pinnedView?: boolean; // preview: a close-up camera from the URL
  zoom: number; // 1 … 2.5, the target the wheel and pinch set
  zoomed: number; // eased zoom the camera uses
  temps: { cpuC: number; gpuC: number; load: number }; // from the running workload: fans, pump display
  shift: number; // 0 … 1: slide the view left so the overlay never covers the PC
  shifted?: number;
  /** the free space for the PC while the overlay is open: centre offset and width, as fractions of the canvas */
  gap?: { dx: number; w: number };
  picked: string | null;
  hovered: string | null;
  pick: (id: string | null) => void;
  hover: (id: string | null) => void;
  togglePower: () => void;
}
export const LiveContext = createContext<React.MutableRefObject<Live> | null>(null);
export const useLive = () => useContext(LiveContext)!;

const LED_OFF = new THREE.Color("#c4c7cb");
const LED_ON = new THREE.Color("#7fd0ff");
const SOFT_OFF = new THREE.Color("#d6d8db");
const SOFT_ON = new THREE.Color("#e9f7ff");
/** Eases power and explode, and colours the shared lights. Mount once. */
export function LiveDriver() {
  const live = useLive();
  useFrame((_, dt) => {
    const s = live.current;
    const step = Math.min(dt, 0.05);
    // fans spin up over ~1.6 s and coast down over ~2.4 s, like real ones
    const target = s.power ? 1 : 0;
    const rate = s.power ? 1 / 1.6 : 1 / 2.4;
    s.level += Math.sign(target - s.level) * Math.min(Math.abs(target - s.level), rate * step);
    const goal = s.apart ? 1 : 0;
    if (!s.pinned) s.t += Math.sign(goal - s.t) * Math.min(Math.abs(goal - s.t), step / 1.8);
    s.zoomed += (s.zoom - s.zoomed) * (1 - Math.exp(-step / 0.16));
    const glow = Math.min(1, s.level * 1.6);
    M.led.color.copy(LED_OFF).lerp(LED_ON, glow);
    M.ledSoft.color.copy(SOFT_OFF).lerp(SOFT_ON, glow);
  });
  return null;
}

export const ease = (x: number) => x * x * (3 - 2 * x);
export const window01 = (t: number, from: number, to: number) => ease(Math.min(1, Math.max(0, (t - from) / (to - from))));

/** Named bodies, for the explode overlap check (?still → window.__pcCheck()). */
export const BODIES = new Map<string, THREE.Object3D>();
export function Body({ id, children }: { id: string; children: ReactNode }) {
  return <group ref={(g) => void (g ? BODIES.set(id, g) : BODIES.delete(id))}>{children}</group>;
}

/** A group that slides by `by` (and optionally turns) as the explode passes its window. */
export function Explode({ by, from, to, turn, children, pivot, id }: { by: [number, number, number]; from: number; to: number; turn?: [number, number, number]; pivot?: [number, number, number]; id?: string; children: ReactNode }) {
  const live = useLive();
  const outer = useRef<THREE.Group>(null);
  const register = (g: THREE.Group | null) => {
    (outer as React.MutableRefObject<THREE.Group | null>).current = g;
    if (id) {
      if (g) BODIES.set(id, g);
      else BODIES.delete(id);
    }
  };
  const inner = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = window01(live.current.t, from, to);
    outer.current?.position.set(by[0] * k, by[1] * k, by[2] * k);
    if (turn && inner.current) {
      const kt = window01(live.current.t, (from + to) / 2, to + 0.12);
      inner.current.rotation.set(turn[0] * kt, turn[1] * kt, turn[2] * kt);
    }
  });
  const p = pivot ?? [0, 0, 0];
  return (
    <group ref={register}>
      <group position={p}>
        <group ref={inner}>
          <group position={[-p[0], -p[1], -p[2]]}>{children}</group>
        </group>
      </group>
    </group>
  );
}

/** An assembly the user can tap: names its meshes and tints them while picked. */
const tinted = new Map<string, THREE.Material>();
const tint = (m: THREE.Material) => {
  let t = tinted.get(m.uuid);
  if (!t) {
    t = m.clone();
    if ("emissive" in t) {
      (t as THREE.MeshLambertMaterial).emissive = new THREE.Color("#2f8cff");
      (t as THREE.MeshLambertMaterial).emissiveIntensity = 0.13;
    }
    tinted.set(m.uuid, t);
  }
  return t;
};
export function Assembly({ id, children }: { id: string; children: ReactNode }) {
  const live = useLive();
  const ref = useRef<THREE.Group>(null);
  const shown = useRef(false);
  useFrame(() => {
    const on = live.current.picked === id;
    if (on === shown.current || !ref.current) return;
    shown.current = on;
    ref.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || o.userData.noTint) return;
      if (on) {
        o.userData.base = mesh.material;
        mesh.material = tint(mesh.material as THREE.Material);
      } else if (o.userData.base) mesh.material = o.userData.base;
    });
  });
  return (
    <group
      ref={ref}
      onClick={(e) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        live.current.pick(live.current.picked === id ? null : id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        live.current.hover(id);
      }}
      onPointerOut={() => live.current.hover(null)}
    >
      {children}
    </group>
  );
}

// ---------- primitives ----------
type V3 = [number, number, number];
const ink = (threshold = 20) => <Edges threshold={threshold} color={INK} />;

/** Box from min/max corners, with ink edges. */
export function Bx({ a, b, m = M.white, e = true, rot, children }: { a: V3; b: V3; m?: THREE.Material; e?: boolean; rot?: V3; children?: ReactNode }) {
  const size: V3 = [Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2])];
  const pos: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  return (
    <mesh position={pos} rotation={rot} material={m}>
      <boxGeometry args={size} />
      {e && ink()}
      {children}
    </mesh>
  );
}

/** Cylinder along an axis ("x" | "y" | "z"), centred at p. */
export function Cy({ p, r, h, axis = "y", m = M.white, e = true, seg = 32, r2 }: { p: V3; r: number; h: number; axis?: "x" | "y" | "z"; m?: THREE.Material; e?: boolean; seg?: number; r2?: number }) {
  const rot: V3 = axis === "x" ? [0, 0, Math.PI / 2] : axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <mesh position={p} rotation={rot} material={m}>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      {e && ink(30)}
    </mesh>
  );
}

/** Any geometry, placed and inked. */
export function G({ g, p = [0, 0, 0], rot, m = M.white, e = true, threshold = 20, scale }: { g: THREE.BufferGeometry; p?: V3; rot?: V3; m?: THREE.Material; e?: boolean; threshold?: number; scale?: V3 }) {
  return (
    <mesh geometry={g} position={p} rotation={rot} material={m} scale={scale}>
      {e && ink(threshold)}
    </mesh>
  );
}

/** Many identical thin boxes (fins, slats) in one draw call. */
export function Fins({ size, positions, scales, m = M.fin }: { size: V3; positions: V3[]; scales?: V3[]; m?: THREE.Material }) {
  const key = size.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geo = useMemo(() => new THREE.BoxGeometry(...size), [key]);
  const set = useMemo(
    () => (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      const o = new THREE.Object3D();
      positions.forEach((p, i) => {
        o.position.set(...p);
        if (scales) o.scale.set(...scales[i]);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geo, positions.length],
  );
  if (!positions.length) return null;
  return <instancedMesh ref={set} args={[geo, m, positions.length]} />;
}
