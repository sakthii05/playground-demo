"use client";
// Graphics cards, by family:
//  · fe-large  NVIDIA Founders Edition (RTX 5090 / 5080): 304 × 137 × 40 mm, two slots
//  · fe-small  NVIDIA Founders Edition (RTX 5070): 242 × 112 × 40 mm, two slots
//  · partner   a three-fan partner card (RTX 5070 Ti, RX 9070 XT, RX 9070 have no reference card)
// The Founders Edition: dark-grey cast frame whose faces loop round two openings and cross in an X; both
// 7-blade ringed fans on the down face; fins showing through both faces (double flow-through); a black
// centre cap over the top edge with the 12V-2×6 recessed at 45°; backlit GEFORCE RTX lettering and white V
// lights; an all-black bracket with 3 × DisplayPort and 1 × HDMI.
// Local frame: x along the card (0 = bracket end), y through it (+ = back face, up), z across (0 = slot edge).
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { extrude, memo, textTexture } from "./geo";
import { Assembly, BODIES, Bx, Fins, G, M, useLive, window01 } from "./kit";
import { GpuFan } from "./Fans";
import { F, PCIE_Y } from "./Board";

export type GpuFamily = "fe-large" | "fe-small" | "partner";
export interface GpuLook {
  family: GpuFamily;
  brand: "NVIDIA" | "AMD" | "Intel";
  name: string;
}
interface Dims {
  L: number;
  H: number;
  T: number; // half thickness
}
export const DIMS: Record<GpuFamily, Dims> = {
  "fe-large": { L: 30.4, H: 13.7, T: 2.0 },
  "fe-small": { L: 24.2, H: 11.2, T: 2.0 },
  partner: { L: 30.4, H: 13.0, T: 2.9 },
};

/** The installed card, read by the power cable so it follows the right card. */
export const GPU_NOW: GpuLook = { family: "fe-large", brand: "NVIDIA", name: "GeForce RTX 5080" };

// How a card comes out: lift it off the slot (the gold fingers clear it), back the ports out of the
// back panel's openings, then slide it straight out through the open side. It never turns, so the cable
// that stays plugged into it simply follows.
const LIFT = 1.25;
const PULL = 0.9;
const OUT = 19;
export const GPU_WINDOW = { from: 0.3, to: 0.62 };
const at = (d: Dims) => new THREE.Vector3(-22.25, PCIE_Y + 0.05 - d.T, F + 1.1);

/** The card's pose for an explode value. */
export function gpuMatrix(t: number, out = new THREE.Matrix4(), family: GpuFamily = GPU_NOW.family) {
  const d = DIMS[family];
  const A = at(d);
  const { from, to } = GPU_WINDOW;
  const kl = window01(t, from, from + 0.05);
  const kp = window01(t, from + 0.045, from + 0.09);
  const ko = window01(t, from + 0.085, to);
  return out.makeTranslation(A.x + PULL * kp, A.y, A.z + LIFT * kl + OUT * ko);
}

/** Where the power cable's plugs sit on the card (back of each plug) and which way their wires leave. */
export function gpuPlugs(look: GpuLook = GPU_NOW): { at: THREE.Vector3; dir: THREE.Vector3; pins: "12v2x6" | "8pin" }[] {
  const d = DIMS[look.family];
  if (look.family !== "partner") return [{ at: new THREE.Vector3(d.L / 2, 0.1 + 2.25 * Math.SQRT1_2, d.H - 0.1 + 2.25 * Math.SQRT1_2), dir: new THREE.Vector3(0, Math.SQRT1_2, Math.SQRT1_2), pins: "12v2x6" }];
  if (look.brand === "AMD")
    return [-1, 1].map((s) => ({ at: new THREE.Vector3(d.L - 8.4 + s * 1.25, 0.6, d.H + 1.45), dir: new THREE.Vector3(0, 0, 1), pins: "8pin" as const }));
  return [{ at: new THREE.Vector3(d.L - 8.4, 0.6, d.H + 1.45), dir: new THREE.Vector3(0, 0, 1), pins: "12v2x6" }];
}

function holePath(pts: [number, number][], r = 0.9) {
  const p = new THREE.Path();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = new THREE.Vector2(...pts[(i + n - 1) % n]);
    const b = new THREE.Vector2(...pts[i]);
    const c = new THREE.Vector2(...pts[(i + 1) % n]);
    const p0 = b.clone().add(a.clone().sub(b).normalize().multiplyScalar(r));
    const p1 = b.clone().add(c.clone().sub(b).normalize().multiplyScalar(r));
    if (i === 0) p.moveTo(p0.x, p0.y);
    else p.lineTo(p0.x, p0.y);
    p.quadraticCurveTo(b.x, b.y, p1.x, p1.y);
  }
  p.closePath();
  return p;
}
const outline = (s: THREE.Shape, L: number, H: number, r: number) => {
  s.moveTo(r, 0);
  s.lineTo(L - r, 0);
  s.quadraticCurveTo(L, 0, L, r);
  s.lineTo(L, H - r);
  s.quadraticCurveTo(L, H, L - r, H);
  s.lineTo(r, H);
  s.quadraticCurveTo(0, H, 0, H - r);
  s.lineTo(0, r);
  s.quadraticCurveTo(0, 0, r, 0);
  return s;
};

function useGlow(off: string, on: string) {
  const live = useLive();
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: off, transparent: true }), [off]);
  const a = useMemo(() => new THREE.Color(off), [off]);
  const b = useMemo(() => new THREE.Color(on), [on]);
  useFrame(() => mat.color.copy(a).lerp(b, Math.min(1, live.current.level * 1.6)));
  return mat;
}

/**
 * The PCIe ×16 edge connector: the PCB tongue that sits in the slot, with its 82 gold fingers a side,
 * 1 mm apart, split by the key notch 11.65 mm from the bracket end. The slot runs local x 2.35 → 11.35.
 */
function EdgeConnector({ T }: { T: number }) {
  const y = T - 0.05;
  const segs: [number, number][] = [
    [2.45, 3.55],
    [3.75, 11.25],
  ];
  const fingers = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const [a, b] of segs) for (let x = a + 0.06; x <= b - 0.05; x += 0.1) for (const side of [-1, 1]) out.push([x, y + side * 0.081, -0.47]);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y]);
  return (
    <group>
      {segs.map(([a, b]) => (
        <Bx key={a} a={[a, y - 0.08, -0.85]} b={[b, y + 0.08, 0.02]} m={M.pcb} />
      ))}
      {/* the strip of board between fingers and shroud, as on the real card */}
      <Bx a={[2.3, y - 0.08, 0.02]} b={[11.4, y + 0.08, 0.32]} m={M.pcbEdge} e={false} />
      <Fins size={[0.06, 0.004, 0.66]} positions={fingers} m={M.pin} />
    </group>
  );
}

/** The bracket: all black, 3 × DisplayPort + HDMI, vent slots. Shared by every card. */
function Bracket({ T, top }: { T: number; top: number }) {
  const port = memo("dp-port", () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(1.6, 0);
    s.lineTo(1.6, 0.5);
    s.lineTo(1.35, 0.72);
    s.lineTo(0, 0.72);
    s.closePath();
    return extrude(s, 0.4, 0, 2);
  });
  return (
    <group>
      <Bx a={[-0.16, -T, -1.1]} b={[0, T, top]} m={M.black} />
      <Bx a={[-0.16, -T, top]} b={[1.0, T, top + 0.16]} m={M.black} />
      {[0.6, 2.9, 5.2].map((z) => (
        <G key={z} g={port} p={[-0.2, -0.3, z]} rot={[0, -Math.PI / 2, 0]} m={M.slot} e={false} />
      ))}
      <Bx a={[-0.22, -0.65, 7.7]} b={[-0.15, 0.25, 9.3]} m={M.slot} e={false} />
      <Fins size={[0.04, Math.min(2.6, 2 * T - 1.2), 0.22]} positions={Array.from({ length: Math.max(2, Math.floor((top - 9.9) / 0.4)) }, (_, i) => [-0.19, 0, 9.9 + i * 0.4] as [number, number, number])} m={M.slot} />
    </group>
  );
}

function FoundersCard({ family }: { family: "fe-large" | "fe-small" }) {
  const { L, H, T } = DIMS[family];
  // finishes from NVIDIA's own photos: the 5090 is near-black, the 5080 dark grey, the 5070 black-grey
  const tone = GPU_NOW.name.includes("5090") ? ["#34373c", "#41444a"] : GPU_NOW.name.includes("5070") ? ["#46494f", "#53565c"] : ["#5f6369", "#6d7178"];
  const frame = useMemo(() => new THREE.MeshLambertMaterial({ color: tone[0], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), [tone[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const edge = useMemo(() => new THREE.MeshLambertMaterial({ color: tone[1], polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), [tone[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const MID = L / 2;
  const tip = MID - 1.15;
  const inner = tip - 3.05 * (H / 13.7);
  const fanR = 5.55 * (H / 13.7);
  const fanX = 1.3 + fanR + 0.05;
  const innerX = (z: number) => inner + (tip - inner) * (1 - Math.abs(z - H / 2) / (H / 2 - 1.1));
  const face = memo(`gpu-face:${family}`, () => {
    const s = outline(new THREE.Shape(), L, H, 1.1);
    const hole: [number, number][] = [[1.15, 1.1], [inner, 1.1], [tip, H / 2], [inner, H - 1.1], [1.15, H - 1.1]];
    s.holes.push(holePath(hole));
    s.holes.push(holePath(hole.map(([x, z]) => [L - x, z] as [number, number]).reverse()));
    return extrude(s, 0.45, 0.06, 20);
  });
  const letters = useMemo(() => textTexture("GEFORCE RTX", { w: 1024, h: 96, font: "700 64px Arial, sans-serif", color: "#ffffff", spacing: 22 }), []);
  const model = useMemo(() => textTexture(GPU_NOW.name.replace("GeForce ", ""), { w: 512, h: 96, font: "700 54px Arial, sans-serif", color: "#ffffff", spacing: 10 }), []);
  const letterMat = useGlow("#3d4045", "#ffffff");
  const vMat = useGlow("#4b4f55", "#f4fbff");
  const modelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: model, transparent: true, color: "#c9ccd1" }), [model]);
  const lettersMat = useMemo(() => {
    letterMat.map = letters;
    return letterMat;
  }, [letterMat, letters]);
  const fins = useMemo(() => {
    const pos: [number, number, number][] = [];
    const sc: [number, number, number][] = [];
    for (let z = 1.45; z < H - 1.4; z += 0.21) {
      const xr = Math.min(innerX(z) - 0.25, MID - 3.3);
      const len = xr - 1.35;
      pos.push([1.35 + len / 2, 0.62, z], [L - 1.35 - len / 2, 0.62, z]);
      sc.push([len, 1, 1], [len, 1, 1]);
    }
    return { pos, sc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);
  const vStrip = (a: [number, number], b: [number, number], y: number, key: string) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    return (
      <mesh key={key} position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]} material={vMat} userData={{ noTint: true }}>
        <boxGeometry args={[Math.hypot(dx, dz) - 1.4, 0.06, 0.13]} />
      </mesh>
    );
  };
  const vs = [];
  for (const y of [T + 0.005, -T - 0.005]) {
    vs.push(vStrip([inner + 0.25, 1.6], [tip - 0.3, H / 2], y, `l1${y}`), vStrip([tip - 0.3, H / 2], [inner + 0.25, H - 1.6], y, `l2${y}`));
    vs.push(vStrip([L - inner - 0.25, 1.6], [L - tip + 0.3, H / 2], y, `r1${y}`), vStrip([L - tip + 0.3, H / 2], [L - inner - 0.25, H - 1.6], y, `r2${y}`));
  }
  const letterW = MID - 3.1 - 2.2;
  return (
    <group>
      <G g={face} p={[0, T, 0]} rot={[Math.PI / 2, 0, 0]} m={frame} />
      <G g={face} p={[0, -T + 0.45, 0]} rot={[Math.PI / 2, 0, 0]} m={frame} />
      <Bx a={[0.3, -T + 0.3, H - 0.45]} b={[L - 0.3, T - 0.3, H]} m={edge} />
      <Bx a={[0.3, -T + 0.3, 0]} b={[L - 0.3, T - 0.3, 0.45]} m={edge} />
      <Bx a={[L - 0.45, -T + 0.3, 0.3]} b={[L, T - 0.3, H - 0.3]} m={edge} />
      <Bx a={[0, -T + 0.3, 0.3]} b={[0.45, T - 0.3, H - 0.3]} m={edge} />
      {[H * 0.32, H * 0.68].map((z) => (
        <mesh key={z} position={[L + 0.01, 0, z]} rotation={[0, 0, Math.PI / 2]} material={M.dark}>
          <cylinderGeometry args={[0.28, 0.28, 0.05, 14]} />
        </mesh>
      ))}
      <Bx a={[MID - 3.1, -T + 0.45, 0.45]} b={[MID + 3.1, T - 0.45, H - 0.45]} m={M.black} e={false} />
      <Bx a={[MID - 2.7, -T - 0.03, H - 0.62]} b={[MID + 2.7, T + 0.03, H + 0.06]} m={M.black} />
      <Bx a={[MID - 1.7, -1.0, H - 0.2]} b={[MID + 1.7, 1.0, H + 0.065]} m={M.dark} e={false} />
      <group position={[MID, 0.1, H - 0.1]} rotation={[-Math.PI / 4, 0, 0]}>
        <Bx a={[-1.2, -0.42, -0.25]} b={[1.2, 0.42, 0.25]} m={M.slot} />
        {/* the cable's plug: housing, latch over the sense pins, and the boot the wires leave from */}
        <Bx a={[-1.15, -0.38, 0.25]} b={[1.15, 0.38, 1.55]} m={M.black} />
        <Bx a={[-0.5, 0.38, 0.45]} b={[0.5, 0.52, 1.25]} m={M.black} />
        <Bx a={[-1.05, -0.33, 1.55]} b={[1.05, 0.33, 2.25]} m={M.dark} />
      </group>
      <Fins size={[1, 1.85, 0.08]} positions={fins.pos} scales={fins.sc} m={M.fin} />
      <GpuFan p={[fanX, -T + 0.85, H / 2]} rot={[-Math.PI / 2, 0, 0]} r={fanR} depth={1.5} />
      <GpuFan p={[L - fanX, -T + 0.85, H / 2]} rot={[-Math.PI / 2, 0, 0]} r={fanR} depth={1.5} />
      <mesh position={[1.1 + letterW / 2, 0, H + 0.012]} material={lettersMat} userData={{ noTint: true }}>
        <planeGeometry args={[letterW, letterW * 0.094]} />
      </mesh>
      {vs}
      <mesh position={[MID, T + 0.012, H - 2.3]} rotation={[-Math.PI / 2, 0, 0]} material={modelMat} userData={{ noTint: true }}>
        <planeGeometry args={[3.4, 0.64]} />
      </mesh>
      <Bracket T={T} top={Math.min(12.4, H - 1.3)} />
      <EdgeConnector T={T} />
    </group>
  );
}

/** A three-fan partner card: shroud with fan rings, a fin stack seen along its edges, a metal backplate. */
function PartnerCard({ brand }: { brand: "NVIDIA" | "AMD" | "Intel" }) {
  const { L, H, T } = DIMS.partner;
  const accent = brand === "AMD" ? "#d6372f" : "#6fae1c";
  const glow = useGlow("#4a4d52", accent);
  const name = useMemo(() => textTexture(GPU_NOW.name.toUpperCase(), { w: 1024, h: 96, font: "700 56px Arial, sans-serif", color: "#ffffff", spacing: 14 }), []);
  const nameMat = useGlow("#4b4f55", "#ffffff");
  const nameM = useMemo(() => {
    nameMat.map = name;
    return nameMat;
  }, [nameMat, name]);
  const fanX = [L / 2 - 9.4, L / 2, L / 2 + 9.4];
  const fanR = 4.45;
  const face = memo("partner-face", () => {
    const s = outline(new THREE.Shape(), L - 1.0, H, 1.4);
    for (const x of fanX) s.holes.push(new THREE.Path().absarc(x - 0.5, H / 2, fanR + 0.15, 0, Math.PI * 2, true));
    return extrude(s, 0.6, 0.08, 40);
  });
  const ring = memo("partner-ring", () => {
    const s = new THREE.Shape().absarc(0, 0, fanR + 0.55, 0, Math.PI * 2, false);
    s.holes.push(new THREE.Path().absarc(0, 0, fanR + 0.15, 0, Math.PI * 2, true));
    return extrude(s, 0.18, 0.03, 48);
  });
  const fins = useMemo(() => Array.from({ length: Math.floor((L - 2.4) / 0.24) }, (_, i) => [1.2 + i * 0.24, 0.0, H / 2] as [number, number, number]), [L, H]);
  return (
    <group>
      {/* fin stack between shroud and backplate, seen along the open edges */}
      <Fins size={[0.06, T + 0.75, H - 1.1]} positions={fins.map(([x, , z]) => [x, (-1.2 + T - 0.45) / 2, z])} m={M.fin} />
      {/* shroud: the fan face, with angular trim and rings round the fans */}
      <G g={face} p={[0.5, -T + 0.6, 0]} rot={[Math.PI / 2, 0, 0]} m={M.dark} />
      {fanX.map((x) => (
        <group key={x}>
          <G g={ring} p={[x, -T - 0.02, H / 2]} rot={[Math.PI / 2, 0, 0]} m={M.steel} />
          <GpuFan p={[x, -T + 0.95, H / 2]} rot={[-Math.PI / 2, 0, 0]} r={fanR} depth={1.3} count={11} ring={false} />
        </group>
      ))}
      {/* top edge: shroud wall with the name and the brand-colour light bar */}
      <Bx a={[0.5, -T + 0.6, H - 0.5]} b={[L - 0.5, T - 0.4, H]} m={M.gpu} />
      <mesh position={[8.6, -0.2, H + 0.012]} material={nameM} userData={{ noTint: true }}>
        <planeGeometry args={[12.0, 1.1]} />
      </mesh>
      <mesh position={[L / 2 + 5.6, -T + 0.35, H + 0.012]} material={glow} userData={{ noTint: true }}>
        <planeGeometry args={[9.0, 0.16]} />
      </mesh>
      {/* far end wall */}
      <Bx a={[L - 0.5, -T, 0]} b={[L, T - 0.4, H]} m={M.gpu} />
      {/* backplate with its flow-through cut-out over the fins */}
      <Bx a={[0, T - 0.4, 0]} b={[L - 9.2, T, H]} m={M.steel} />
      <Bx a={[L - 2.0, T - 0.4, 0]} b={[L, T, H]} m={M.steel} />
      <Bx a={[L - 9.2, T - 0.4, 0]} b={[L - 2.0, T, 0.9]} m={M.steel} />
      <Bx a={[L - 9.2, T - 0.4, H - 0.9]} b={[L - 2.0, T, H]} m={M.steel} />
      {[1.0, 6, 12, 18].map((x) => (
        <mesh key={x} position={[x, T + 0.01, H - 1.6]} rotation={[-Math.PI / 2, 0, 0]} material={M.dark}>
          <circleGeometry args={[0.22, 12]} />
        </mesh>
      ))}
      {/* power sockets on the top edge */}
      {gpuPlugs({ family: "partner", brand, name: "" }).map((p, i) => (
        <group key={i}>
          <Bx a={[p.at.x - (p.pins === "8pin" ? 1.05 : 1.2), p.at.y - 0.45, H]} b={[p.at.x + (p.pins === "8pin" ? 1.05 : 1.2), p.at.y + 0.45, H + 0.35]} m={M.slot} />
          <Bx a={[p.at.x - (p.pins === "8pin" ? 1.0 : 1.15), p.at.y - 0.4, H + 0.35]} b={[p.at.x + (p.pins === "8pin" ? 1.0 : 1.15), p.at.y + 0.4, p.at.z]} m={M.black} />
          <Bx a={[p.at.x - 0.45, p.at.y + 0.4, H + 0.55]} b={[p.at.x + 0.45, p.at.y + 0.55, H + 1.1]} m={M.black} />
        </group>
      ))}
      <Bracket T={T} top={H - 0.6} />
      <EdgeConnector T={T} />
    </group>
  );
}

export function Gpu({ look }: { look: GpuLook }) {
  Object.assign(GPU_NOW, look);
  const live = useLive();
  const ref = useRef<THREE.Group>(null);
  // the pose is only ever written here, never as a prop, so a re-render (a tap, a zoom) can't reset it
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    gpuMatrix(live.current.t, g.matrix, look.family);
    g.matrixWorldNeedsUpdate = true;
  });
  return (
    <Assembly id="gpu">
      <group ref={(g) => void ((ref as React.MutableRefObject<THREE.Group | null>).current = g, g ? BODIES.set("gpu", g) : BODIES.delete("gpu"))} matrixAutoUpdate={false}>
        {look.family === "partner" ? <PartnerCard brand={look.brand} /> : <FoundersCard family={look.family} />}
      </group>
    </Assembly>
  );
}
