"use client";
// A Z890 ATX board (305 × 244 mm) on its standoffs: green solder mask with its traces, vias, silkscreen
// and gold pads (one drawn layer), finned aluminium VRM heatsinks over their chokes and MOSFETs, the
// LGA 1851 socket with its gold land field, slots, headers with pins, audio, chips and the small
// surface-mount parts round them. The board face sits at z = F.
import { useMemo } from "react";
import * as THREE from "three";
import { extrude, memo, polyShape } from "./geo";
import { Assembly, Body, Bx, Cy, Explode, Fins, G, M } from "./kit";

export const F = -10.14; // board front face
export const BOARD = { x0: -21.6, x1: 2.8, y0: 17.4, y1: 47.9 };
export const CPU = { x: -13.1, y: 37.9 };
export const DIMM_X = [-7.5, -6.6, -5.7, -4.8];
export const PCIE_Y = 30.7;
export const HEADERS = {
  cpuFan: [-5.9, 47.2] as [number, number],
  pump: [-3.9, 47.2] as [number, number],
  sysFan: [-10.0, 47.35] as [number, number],
  fanHub: [0.0, 17.95] as [number, number],
};

type V3 = [number, number, number];
const SCREWS: [number, number][] = [[-20.9, 47.2], [-20.9, 30.5], [-20.9, 18.1], [-8.6, 47.2], [-8.6, 18.1], [2.1, 47.2], [2.1, 30.5], [2.1, 18.1], [-8.6, 30.0]];

// ---------- the printed layer ----------
const S = 64; // px per cm
function boardTexture(chipset: string) {
  const W = Math.round((BOARD.x1 - BOARD.x0) * S);
  const H = Math.round((BOARD.y1 - BOARD.y0) * S);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const X = (x: number) => (x - BOARD.x0) * S;
  const Y = (y: number) => (BOARD.y1 - y) * S;
  // solder mask
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#2e7044");
  grad.addColorStop(1, "#27633b");
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // copper pours under the VRM, slightly lighter
  g.fillStyle = "#31774a";
  g.fillRect(X(-17.4), Y(47.4), X(-6.4) - X(-17.4), Y(42.0) - Y(47.4));
  g.fillRect(X(-18.2), Y(42.0), X(-15.8) - X(-18.2), Y(33.0) - Y(42.0));
  // traces
  g.strokeStyle = "#3f8d58";
  g.lineCap = "round";
  g.lineJoin = "round";
  const run = (pts: [number, number][], w = 1.6) => {
    g.lineWidth = w;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.stroke();
  };
  for (let i = 0; i < 26; i++) {
    const y = 35.0 + i * 0.22;
    run([[-10.3, y], [-9.4, y], [-8.9, y + (i - 13) * 0.05], [-7.9, y + (i - 13) * 0.05]]);
  }
  for (let i = 0; i < 16; i++) {
    const x = -15.0 + i * 0.2;
    run([[x, 34.4], [x, 33.9], [x + (i - 8) * 0.06, 33.4], [x + (i - 8) * 0.06, 31.2]]);
  }
  for (let i = 0; i < 12; i++) {
    const y = 19.6 + i * 0.3;
    run([[-9.6, y + 2], [-10.4, y + 1.2], [-15.4, y + 1.2]]);
    run([[2.4, y], [1.5, y]]);
  }
  for (let i = 0; i < 10; i++) run([[-10.6, 29.6 - i * 0.2], [-6.0, 29.6 - i * 0.2], [-5.0, 30.6 - i * 0.2], [1.0, 30.6 - i * 0.2]], 1.3);
  for (let i = 0; i < 8; i++) run([[-19.0 + i * 0.25, 33.0], [-19.0 + i * 0.25, 29.0], [-17.6 + i * 0.2, 27.6]], 1.3);
  for (let i = 0; i < 6; i++) run([[-6.4, 46.8 - i * 0.22], [-4.4, 46.8 - i * 0.22], [-3.0, 45.4 - i * 0.22], [-3.0, 41.0 - i * 0.22]], 1.2);
  // vias
  g.fillStyle = "#58a271";
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const viaField = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.arc(X(x0 + (x1 - x0) * rnd()), Y(y0 + (y1 - y0) * rnd()), 2.2, 0, Math.PI * 2);
      g.fill();
    }
  };
  viaField(-10.4, 33.0, -8.0, 44.0, 60);
  viaField(-16.0, 30.9, -11.0, 34.3, 40);
  viaField(-9.0, 17.6, 1.4, 30.0, 70);
  viaField(-21.0, 18.0, -10.0, 30.0, 60);
  // mounting-hole copper rings
  g.strokeStyle = "#c9a65a";
  g.lineWidth = 7;
  for (const [x, y] of SCREWS) {
    g.beginPath();
    g.arc(X(x), Y(y), 0.5 * S, 0, Math.PI * 2);
    g.stroke();
  }
  // silkscreen
  g.strokeStyle = "#e6eee8";
  g.fillStyle = "#e6eee8";
  g.lineWidth = 2;
  const box = (x0: number, y0: number, x1: number, y1: number) => g.strokeRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1));
  const label = (t: string, x: number, y: number, size = 15, rot = 0) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(rot);
    g.font = `600 ${size}px "Arial Narrow", Arial, sans-serif`;
    g.fillText(t, 0, 0);
    g.restore();
  };
  box(-16.3, 33.9, -9.9, 41.9);
  label(chipset.startsWith("AMD") ? "AM5" : "LGA1851", -15.8, 33.5, 14);
  ["DIMM_A1", "DIMM_A2", "DIMM_B1", "DIMM_B2"].forEach((t, i) => label(t, DIMM_X[i] - 0.15, 31.0, 12, -Math.PI / 2));
  label("PCIEX16(G5)", -10.6, 31.4, 14);
  label("PCIEX16(G4)", -10.6, 21.2, 13);
  label("M.2_1(SOCKET3)", -18.6, 34.5, 12);
  label("M.2_2 / M.2_3", -16.8, 29.3, 12);
  label("CPU_FAN", HEADERS.cpuFan[0] - 0.7, 46.2, 12);
  label("AIO_PUMP", HEADERS.pump[0] - 0.8, 46.2, 12);
  label("ATX_12V_1", -17.1, 46.4, 12);
  label("ATX_12V_2", -14.6, 46.4, 12);
  label("EATXPWR", 0.2, 39.9, 12, -Math.PI / 2);
  label("SATA6G_1-4", 0.6, 23.8, 12, -Math.PI / 2);
  label("USB3_1", 0.4, 29.6, 12, -Math.PI / 2);
  label("F_PANEL", -6.8, 18.75, 12);
  label("USB_1", -13.4, 18.75, 12);
  label("USB_2", -16.4, 18.75, 12);
  label("SYS_FAN1", -10.8, 46.45, 12);
  label("FAN_HUB", -0.7, 18.75, 12);
  label("BAT", -1.2, 33.4, 12);
  label("CLRTC", -3.6, 31.6, 11);
  label(`${chipset.replace(/^(Intel|AMD) /, "")} ATX`, -7.6, 26.6, 22);
  label("REV 1.02", -7.6, 25.9, 13);
  box(-21.4, 18.0, -17.4, 26.6);
  g.setLineDash([10, 8]);
  g.strokeRect(X(-21.5), Y(26.8), X(-17.2) - X(-21.5), Y(17.8) - Y(26.8));
  g.setLineDash([]);
  label("AUDIO", -21.2, 26.0, 12);
  // polarity marks for the capacitors round the socket
  for (let i = 0; i < 6; i++) {
    const x = -15.4 + i * 1.05;
    g.beginPath();
    g.arc(X(x), Y(33.95), 0.36 * S, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(X(x), Y(33.95), 0.36 * S, Math.PI * 0.5, Math.PI * 1.5);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A sculpted cover: a polygon in the board plane (x, y), raised `h` off the board, with a chamfered top. */
function Cover({ pts, h, m = M.white, z = F, top = 0.35 }: { pts: [number, number][]; h: number; m?: THREE.Material; z?: number; top?: number }) {
  const key = `cover:${JSON.stringify(pts)}:${h}`;
  const base = memo(key, () => extrude(polyShape(pts), h - top, 0.05, 4));
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const inset = memo(`${key}:top`, () => extrude(polyShape(pts.map(([x, y]) => [cx + (x - cx) * 0.9, cy + (y - cy) * 0.86])), top, 0.04, 4));
  return (
    <group position={[0, 0, z]}>
      <G g={base} m={m} />
      <G g={inset} p={[0, 0, h - top]} m={m} />
    </group>
  );
}

/** A finned heatsink: a base plate with fins standing on it, stacked along x or y. */
function Heatsink({ x0, x1, y0, y1, h, along }: { x0: number; x1: number; y0: number; y1: number; h: number; along: "x" | "y" }) {
  const fins = useMemo(() => {
    const out: V3[] = [];
    const pitch = 0.42;
    if (along === "x") for (let x = x0 + 0.2; x <= x1 - 0.15; x += pitch) out.push([x, (y0 + y1) / 2, F + 0.45 + (h - 0.45) / 2]);
    else for (let y = y0 + 0.2; y <= y1 - 0.15; y += pitch) out.push([(x0 + x1) / 2, y, F + 0.45 + (h - 0.45) / 2]);
    return out;
  }, [x0, x1, y0, y1, h, along]);
  const size: V3 = along === "x" ? [0.14, y1 - y0, h - 0.45] : [x1 - x0, 0.14, h - 0.45];
  return (
    <group>
      <Bx a={[x0, y0, F + 0.1]} b={[x1, y1, F + 0.45]} m={M.aluDark} />
      <Fins size={size} positions={fins} m={M.alu} />
      <Bx a={[x0, y0, F + h - 0.06]} b={[x1, y0 + 0.3, F + h]} m={M.alu} />
      <Bx a={[x0, y1 - 0.3, F + h - 0.06]} b={[x1, y1, F + h]} m={M.alu} />
    </group>
  );
}

/** Rows of header pins. */
function Pins({ x, y, cols, rows, pitch = 0.254, h = 0.6, along = "x" }: { x: number; y: number; cols: number; rows: number; pitch?: number; h?: number; along?: "x" | "y" }) {
  const pos = useMemo(() => {
    const out: V3[] = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) out.push(along === "x" ? [x + i * pitch, y + j * pitch, F + h / 2] : [x + j * pitch, y + i * pitch, F + h / 2]);
    return out;
  }, [x, y, cols, rows, pitch, h, along]);
  return <Fins size={[0.064, 0.064, h]} positions={pos} m={M.pin} />;
}

function Smd() {
  const { dark, beige } = useMemo(() => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const dark: V3[] = [];
    const beige: V3[] = [];
    const field = (x0: number, y0: number, x1: number, y1: number, n: number) => {
      for (let i = 0; i < n; i++) (i % 3 ? dark : beige).push([x0 + (x1 - x0) * rnd(), y0 + (y1 - y0) * rnd(), F + 0.025]);
    };
    field(-10.2, 33.2, -8.3, 44.0, 46);
    field(-16.0, 31.25, -11.0, 31.7, 24);
    field(-3.6, 32.4, 0.8, 41.6, 40);
    field(-21.2, 18.2, -17.8, 26.2, 30);
    field(-16.5, 18.6, -10.6, 20.7, 30);
    field(-15.4, 22.0, -10.6, 24.8, 26);
    field(-6.2, 46.6, -2.6, 47.7, 16);
    return { dark, beige };
  }, []);
  return (
    <group>
      <Fins size={[0.16, 0.08, 0.05]} positions={dark} m={M.smd} />
      <Fins size={[0.1, 0.05, 0.05]} positions={beige} m={M.ceramic} />
    </group>
  );
}

export interface BoardLook {
  chipset: string;
  tier: "best" | "value";
  socket: "LGA1851" | "AM5";
  cpuName: string;
  cpuBrand: string;
}

function Pcb({ look }: { look: BoardLook }) {
  const map = useMemo(() => boardTexture(look.chipset), [look.chipset]);
  const printed = useMemo(() => new THREE.MeshLambertMaterial({ map }), [map]);
  const chokes = useMemo(() => [...Array.from({ length: 9 }, (_, i) => [-16.1 + i * 1.08, 42.6, F + 0.42] as V3), ...Array.from({ length: 7 }, (_, i) => [-16.45, 34.4 + i * 1.08, F + 0.42] as V3)], []);
  const mosfets = useMemo(() => [...Array.from({ length: 9 }, (_, i) => [-16.1 + i * 1.08, 41.75, F + 0.06] as V3), ...Array.from({ length: 7 }, (_, i) => [-17.95, 34.4 + i * 1.08, F + 0.05] as V3)], []);
  return (
    <group>
      {/* standoffs on the tray, then the board itself and its printed face */}
      {SCREWS.map(([x, y]) => (
        <Cy key={`s${x}${y}`} p={[x, y, -10.6]} r={0.28} h={0.6} axis="z" m={M.gold} seg={6} e={false} />
      ))}
      <Bx a={[BOARD.x0, BOARD.y0, -10.3]} b={[BOARD.x1, BOARD.y1, F]} m={M.pcbEdge} />
      <mesh position={[(BOARD.x0 + BOARD.x1) / 2, (BOARD.y0 + BOARD.y1) / 2, F + 0.004]} material={printed} userData={{ noTint: false }}>
        <planeGeometry args={[BOARD.x1 - BOARD.x0, BOARD.y1 - BOARD.y0]} />
      </mesh>
      {SCREWS.map(([x, y]) => (
        <group key={`h${x}${y}`}>
          <Cy p={[x, y, F + 0.06]} r={0.42} h={0.1} axis="z" m={M.steel} seg={20} />
          <Bx a={[x - 0.26, y - 0.04, F + 0.11]} b={[x + 0.26, y + 0.04, F + 0.13]} m={M.dark} e={false} />
          <Bx a={[x - 0.04, y - 0.26, F + 0.11]} b={[x + 0.04, y + 0.26, F + 0.13]} m={M.dark} e={false} />
        </group>
      ))}
      {/* power delivery: chokes, their MOSFETs, solid capacitors */}
      <Fins size={[0.92, 0.92, 0.84]} positions={chokes} m={M.grey} />
      <Fins size={[0.62, 0.5, 0.1]} positions={mosfets} m={M.chip} />
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i}>
          <Cy p={[-15.4 + i * 1.05, 33.95, F + 0.32]} r={0.3} h={0.64} axis="z" m={M.steel} seg={16} />
          <Cy p={[-15.4 + i * 1.05, 33.95, F + 0.65]} r={0.3} h={0.02} axis="z" m={M.dark} seg={16} e={false} />
        </group>
      ))}
      {/* I/O shroud (dark), finned VRM heatsinks */}
      <Cover pts={[[-21.6, 47.4], [-19.0, 47.4], [-19.0, 33.6], [-19.6, 33.0], [-21.6, 33.0]]} h={3.2} m={M.shroudDark} />
      <Bx a={[-19.0, 44.0, F + 2.6]} b={[-18.85, 47.2, F + 3.0]} m={M.alu} e={false} />
      <Heatsink x0={-18.9} x1={-17.0} y0={34.2} y1={42.6} h={look.tier === "best" ? 2.6 : 1.8} along="y" />
      <Heatsink x0={-16.8} x1={-6.8} y0={43.4} y1={46.4} h={look.tier === "best" ? 2.4 : 1.6} along="x" />
      {/* CPU power: 2 × 8-pin EPS */}
      {[-16.2, -13.7].map((x) => (
        <Bx key={x} a={[x - 1.0, 46.85, F]} b={[x + 1.0, 47.75, F + 1.1]} m={M.chip} />
      ))}
      {/* M.2 heatsinks */}
      <Cover pts={[[-18.8, 33.4], [-11.4, 33.4], [-10.8, 32.8], [-10.8, 31.8], [-18.8, 31.8]]} h={0.75} m={M.alu} />
      <Fins size={[0.1, 1.2, 0.04]} positions={Array.from({ length: 12 }, (_, i) => [-18.2 + i * 0.6, 32.6, F + 0.77] as V3)} m={M.aluDark} />
      {/* the lower M.2 plate: one brushed heatsink over two drives, with its tool-less latches */}
      <Cover pts={[[-17.0, 29.0], [-10.2, 29.0], [-10.2, 22.4], [-16.2, 22.4], [-17.0, 23.2]]} h={look.tier === "best" ? 0.85 : 0.6} m={M.alu} />
      <Fins size={[6.2, 0.06, 0.03]} positions={Array.from({ length: 9 }, (_, i) => [-13.55, 23.0 + i * 0.7, F + (look.tier === "best" ? 0.86 : 0.61)] as V3)} m={M.aluDark} />
      {[[-16.4, 28.4], [-10.8, 23.0]].map(([sx, sy]) => (
        <Cy key={sx} p={[sx, sy, F + (look.tier === "best" ? 0.95 : 0.7)]} r={0.32} h={0.2} axis="z" m={M.white} seg={18} />
      ))}
      <Cy p={[-12.0, 33.0, F + 0.87]} r={0.3} h={0.2} axis="z" m={M.white} seg={18} />
      {/* PCIe slot release button at the graphics slot's end */}
      <Bx a={[-10.15, PCIE_Y - 0.4, F]} b={[-9.55, PCIE_Y + 0.4, F + 0.5]} m={M.white} />
      {/* slots: graphics slot in steel armour, x4, x1 and a full-length x4 */}
      <Bx a={[-19.9, PCIE_Y - 0.48, F]} b={[-10.9, PCIE_Y + 0.48, F + 1.1]} m={M.steel} />
      <Bx a={[-10.9, PCIE_Y - 0.48, F]} b={[-10.2, PCIE_Y + 0.48, F + 1.25]} m={M.grey} />
      <Bx a={[-19.9, 21.0, F]} b={[-10.9, 21.7, F + 0.95]} m={M.chip} />
      {/* chipset heatsink with grooves */}
      <Cover pts={[[-9.6, 29.2], [1.6, 29.2], [2.4, 28.4], [2.4, 18.4], [-6.0, 18.4], [-9.6, 22.0]]} h={1.0} m={M.alu} />
      <Fins size={[0.1, 7.6, 0.04]} positions={Array.from({ length: 9 }, (_, i) => [-7.6 + i * 0.5, 23.6, F + 1.01] as V3)} m={M.aluDark} />
      {/* audio: codec under its shield, gold audio capacitors */}
      <Bx a={[-20.6, 23.6, F]} b={[-19.0, 25.2, F + 0.22]} m={M.steel} />
      {[19.0, 20.3, 21.6].map((y) => (
        <group key={y}>
          <Cy p={[-20.4, y, F + 0.45]} r={0.38} h={0.9} axis="z" m={M.gold} seg={18} />
          <Cy p={[-18.8, y, F + 0.45]} r={0.38} h={0.9} axis="z" m={M.gold} seg={18} />
        </group>
      ))}
      {/* chips: super I/O, BIOS flash, clock generator, LAN, Wi-Fi card */}
      <Bx a={[-14.0, 19.0, F]} b={[-12.4, 20.6, F + 0.12]} m={M.chip} />
      <Bx a={[-16.6, 21.85, F]} b={[-15.6, 22.3, F + 0.15]} m={M.chip} />
      <Bx a={[-9.2, 33.6, F]} b={[-8.3, 34.5, F + 0.12]} m={M.chip} />
      <Bx a={[-20.2, 28.6, F]} b={[-19.2, 29.6, F + 0.1]} m={M.chip} />
      <Bx a={[-1.8, 40.0, F]} b={[0.4, 42.0, F + 0.22]} m={M.steel} />
      <Smd />
      {/* CMOS battery and the clear-CMOS jumper */}
      <Cy p={[-0.6, 31.9, F + 0.17]} r={1.0} h={0.32} axis="z" m={M.steel} seg={36} />
      <Pins x={-3.4} y={31.9} cols={2} rows={1} />
      {/* 24-pin power and SATA ports on the front edge */}
      <Bx a={[1.4, 34.0, F]} b={[2.8, 39.4, F + 1.0]} m={M.chip} />
      <Bx a={[1.5, 19.2, F]} b={[2.8, 23.4, F + 1.0]} m={M.chip} />
      {[0, 1, 2, 3].map((i) => (
        <Bx key={i} a={[2.8, 19.4 + i * 1.0, F + 0.2]} b={[2.84, 20.1 + i * 1.0, F + 0.8]} m={M.black} e={false} />
      ))}
      {/* USB 3 header and the front USB-C header on the front edge */}
      <Bx a={[1.6, 26.2, F]} b={[2.8, 29.0, F + 0.8]} m={M.chip} />
      <Bx a={[1.7, 29.9, F]} b={[2.8, 31.0, F + 0.7]} m={M.chip} />
      <Bx a={[2.8, 30.15, F + 0.2]} b={[2.84, 30.75, F + 0.5]} m={M.black} e={false} />
      {/* bottom-edge headers with their pins: USB 2.0 ×2, front panel, fan hub */}
      {[-16.4, -13.4].map((x) => (
        <group key={x}>
          <Bx a={[x, 17.62, F]} b={[x + 1.4, 18.32, F + 0.1]} m={M.chip} />
          <Pins x={x + 0.2} y={17.84} cols={5} rows={2} />
        </group>
      ))}
      <Bx a={[-6.8, 17.62, F]} b={[-5.4, 18.32, F + 0.1]} m={M.chip} />
      <Pins x={-6.6} y={17.84} cols={5} rows={2} />
      {/* fan headers (4-pin) and their pins */}
      {[HEADERS.cpuFan, HEADERS.pump, HEADERS.sysFan, HEADERS.fanHub].map(([x, y]) => (
        <group key={`${x}${y}`}>
          <Bx a={[x - 0.55, y - 0.3, F]} b={[x + 0.55, y + 0.3, F + 0.6]} m={M.white} />
          <Fins size={[0.07, 0.07, 0.12]} positions={[0, 1, 2, 3].map((i) => [x - 0.38 + i * 0.254, y, F + 0.62] as V3)} m={M.pin} />
        </group>
      ))}
      {/* debug LEDs */}
      {[0, 1, 2, 3].map((i) => (
        <Bx key={i} a={[0.6, 42.6 + i * 0.5, F]} b={[0.95, 42.85 + i * 0.5, F + 0.12]} m={M.led} e={false} />
      ))}
      {/* rear I/O shield in the back panel: USB stacks, 5 GbE, Wi-Fi antenna posts, audio */}
      <Bx a={[-22.95, 31.8, -10.6]} b={[-22.75, 47.4, -6.6]} m={M.dark} />
      {[45.4, 42.6, 39.8, 37.0].map((y) => (
        <group key={y}>
          <Bx a={[-23.05, y, -10.2]} b={[-22.75, y + 1.9, -8.9]} m={M.steel} />
          <Bx a={[-23.06, y + 0.35, -10.0]} b={[-23.0, y + 0.75, -9.1]} m={M.black} e={false} />
          <Bx a={[-23.06, y + 1.15, -10.0]} b={[-23.0, y + 1.55, -9.1]} m={M.black} e={false} />
        </group>
      ))}
      <Bx a={[-23.05, 34.2, -10.2]} b={[-22.75, 36.2, -8.6]} m={M.steel} />
      {[45.8, 44.3].map((y) => (
        <Cy key={y} p={[-23.2, y, -7.5]} r={0.32} h={0.5} axis="x" m={M.gold} seg={16} />
      ))}
      {[33.0, 34.2, 35.4].map((y) => (
        <Cy key={y} p={[-23.0, y, -7.4]} r={0.32} h={0.25} axis="x" m={M.black} seg={16} />
      ))}
    </group>
  );
}

/** The cooler's four mounting holes, plated, round the socket (LGA 1851: 78 × 78 mm; AM5: 54 × 90 mm). */
function MountHoles({ socket }: { socket: "LGA1851" | "AM5" }) {
  const { x, y } = CPU;
  const [dx, dy] = socket === "AM5" ? [2.7, 4.5] : [3.9, 3.9];
  return (
    <group>
      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => (
        <group key={`${sx}${sy}`}>
          <Cy p={[x + sx * dx, y + sy * dy, F + 0.01]} r={0.36} h={0.02} axis="z" m={M.pin} seg={24} e={false} />
          <Cy p={[x + sx * dx, y + sy * dy, F + 0.02]} r={0.2} h={0.02} axis="z" m={M.black} seg={20} e={false} />
        </group>
      ))}
    </group>
  );
}

function Socket({ socket }: { socket: "LGA1851" | "AM5" }) {
  const { x, y } = CPU;
  if (socket === "AM5")
    return (
      <group>
        {/* AM5: square socket, gold land grid, a load plate on two hinges and the lever down one side */}
        <Bx a={[x - 3.0, y - 3.0, F]} b={[x + 3.0, y + 3.0, F + 0.3]} m={M.chip} />
        <Bx a={[x - 1.9, y - 1.9, F + 0.3]} b={[x + 1.9, y + 1.9, F + 0.34]} m={M.pin} e={false} />
        <Bx a={[x - 2.95, y + 2.2, F + 0.35]} b={[x + 2.95, y + 2.95, F + 0.55]} m={M.steel} />
        <Bx a={[x - 2.95, y - 2.95, F + 0.35]} b={[x + 2.95, y - 2.2, F + 0.55]} m={M.steel} />
        <Bx a={[x - 2.95, y - 2.2, F + 0.35]} b={[x - 2.25, y + 2.2, F + 0.55]} m={M.steel} />
        <Bx a={[x + 2.25, y - 2.2, F + 0.35]} b={[x + 2.95, y + 2.2, F + 0.55]} m={M.steel} />
        <Cy p={[x - 3.3, y, F + 0.3]} r={0.12} h={6.2} m={M.steel} seg={10} />
        <Bx a={[x - 3.7, y + 3.0, F + 0.18]} b={[x - 3.1, y + 3.3, F + 0.42]} m={M.steel} />
        {[[-2.6, -3.15], [2.6, -3.15], [-2.6, 3.15], [2.6, 3.15]].map(([dx, dy]) => (
          <Cy key={`${dx}${dy}`} p={[x + dx, y + dy, F + 0.62]} r={0.16} h={0.14} axis="z" m={M.dark} seg={12} e={false} />
        ))}
      </group>
    );
  return (
    <group>
      {/* socket body with its gold land grid, the loading frame (ILM) and lever */}
      <Bx a={[x - 2.8, y - 3.5, F]} b={[x + 2.8, y + 3.5, F + 0.3]} m={M.chip} />
      <Bx a={[x - 1.8, y - 2.18, F + 0.3]} b={[x + 1.8, y + 2.18, F + 0.34]} m={M.pin} e={false} />
      <Bx a={[x - 2.75, y + 2.45, F + 0.35]} b={[x + 2.75, y + 3.45, F + 0.55]} m={M.steel} />
      <Bx a={[x - 2.75, y - 3.45, F + 0.35]} b={[x + 2.75, y - 2.45, F + 0.55]} m={M.steel} />
      <Bx a={[x - 2.75, y - 2.45, F + 0.35]} b={[x - 2.1, y + 2.45, F + 0.55]} m={M.steel} />
      <Bx a={[x + 2.1, y - 2.45, F + 0.35]} b={[x + 2.75, y + 2.45, F + 0.55]} m={M.steel} />
      <Cy p={[x - 3.15, y, F + 0.3]} r={0.12} h={6.8} m={M.steel} seg={10} />
      <Bx a={[x - 3.6, y + 3.3, F + 0.18]} b={[x - 2.95, y + 3.6, F + 0.42]} m={M.steel} />
      {[[-2.5, -3.2], [2.5, -3.2], [-2.5, 3.2], [2.5, 3.2]].map(([dx, dy]) => (
        <Cy key={`${dx}${dy}`} p={[x + dx, y + dy, F + 0.62]} r={0.16} h={0.14} axis="z" m={M.dark} seg={12} e={false} />
      ))}
    </group>
  );
}

/** The lid's print, laid out as on the real chips (from Intel's and AMD's product photos). */
function lidPrint(amd: boolean, name: string) {
  const c = document.createElement("canvas");
  c.width = amd ? 700 : 520;
  c.height = amd ? 700 : 848;
  const g = c.getContext("2d")!;
  const ink = "#55585e";
  g.fillStyle = ink;
  g.strokeStyle = ink;
  const matrix = (x: number, y: number, n: number, cell: number) => {
    let seed = name.length * 97 + n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        seed = (seed * 16807) % 2147483647;
        if (i === 0 || j === n - 1 || seed % 3 === 0) g.fillRect(x + i * cell, y + j * cell, cell, cell);
      }
  };
  if (amd) {
    const [, tier = "7", model = "9800X3D"] = name.match(/Ryzen (d) (S+)/) ?? [];
    g.font = "800 112px Arial, sans-serif";
    g.fillText("AMD", 92, 200);
    g.fillRect(380, 118, 74, 74);
    g.clearRect(400, 138, 34, 34);
    g.font = "700 88px Arial, sans-serif";
    g.fillText("RYZEN", 92, 318);
    g.font = "italic 600 40px Arial, sans-serif";
    g.fillText(`AMD Ryzen ${tier} ${model}`, 92, 400);
    matrix(92, 450, 14, 9);
    g.font = "500 26px 'Courier New', monospace";
    ["100-000001084", "CF 2428PGY", "F41125944001", "MADE IN MALAYSIA", "© 2024 AMD"].forEach((t, i) => g.fillText(t, 250, 470 + i * 32));
  } else {
    const [, tier = "9", model = "285K"] = name.match(/Ultra (d) (S+)/) ?? [];
    g.lineWidth = 5;
    g.strokeRect(70, 150, 34, 34);
    g.fillRect(96, 176, 14, 14);
    g.font = "600 40px 'Courier New', monospace";
    [`INTEL CORE ULTRA ${tier}`, model, "SRQD5", "X433N158"].forEach((t, i) => g.fillText(t, 70, 262 + i * 66));
    g.lineWidth = 3;
    g.beginPath();
    g.arc(392, 450, 18, 0, Math.PI * 2);
    g.stroke();
    g.font = "600 20px Arial";
    g.fillText("e4", 381, 457);
    matrix(70, 500, 16, 7);
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(70, 740);
    g.lineTo(70, 780);
    g.lineTo(110, 780);
    g.closePath();
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * The CPU itself.
 *  Intel LGA 1851 (Core Ultra 200S): 45 × 37.5 mm teal substrate; the nickel lid is a tall rounded body
 *  with wider "wings" across its middle, capacitors along the substrate edges.
 *  AMD AM5 (Ryzen 9000): 40 × 40 mm; the "octopus" lid has two cut-outs on every side, and the gold
 *  capacitors sit on the substrate inside them.
 */
export function Cpu({ look }: { look: BoardLook }) {
  const { x, y } = CPU;
  const amd = look.socket === "AM5";
  const IN = { nw: 1.3, ww: 1.62, hh: 2.12, w0: -1.08, w1: 1.3 };
  const ihs = memo(amd ? "ihs-am5" : "ihs-1851", () => {
    if (amd) {
      const o: [number, number][] = [];
      const a = 1.75;
      const n = 0.32;
      const edge: [number, number][] = [[-a + 0.12, -a], [-0.95, -a], [-0.95, -a + n], [-0.45, -a + n], [-0.45, -a], [0.45, -a], [0.45, -a + n], [0.95, -a + n], [0.95, -a], [a - 0.12, -a]];
      for (let k = 0; k < 4; k++) {
        const c = Math.cos((k * Math.PI) / 2);
        const sn = Math.sin((k * Math.PI) / 2);
        for (const [u, w] of edge) o.push([u * c - w * sn, u * sn + w * c]);
      }
      return extrude(polyShape(o), 0.3, 0.03, 4);
    }
    const { nw, ww, hh, w0, w1 } = IN;
    return extrude(
      polyShape([[-nw + 0.2, -hh], [nw - 0.2, -hh], [nw, -hh + 0.2], [nw, w0 - 0.15], [ww - 0.12, w0], [ww, w0 + 0.12], [ww, w1 - 0.12], [ww - 0.12, w1], [nw, w1 + 0.15], [nw, hh - 0.2], [nw - 0.2, hh], [-nw + 0.2, hh], [-nw, hh - 0.2], [-nw, w1 + 0.15], [-ww + 0.12, w1], [-ww, w1 - 0.12], [-ww, w0 + 0.12], [-ww + 0.12, w0], [-nw, w0 - 0.15], [-nw, -hh + 0.2]]),
      0.3,
      0.03,
      4,
    );
  });
  const print = useMemo(() => new THREE.MeshBasicMaterial({ map: lidPrint(amd, look.cpuName), transparent: true, depthWrite: false }), [amd, look.cpuName]);
  const substrate = useMemo(() => new THREE.MeshLambertMaterial({ color: amd ? "#2b5b4c" : "#2f8a78", polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), [amd]);
  const caps = useMemo(() => {
    const out: [number, number, number][] = [];
    if (amd)
      for (let k = 0; k < 4; k++)
        for (const c0 of [-0.7, 0.7])
          for (const d of [-0.12, 0.12]) {
            const u = c0 + d;
            const w = -1.62;
            const c = Math.cos((k * Math.PI) / 2);
            const sn = Math.sin((k * Math.PI) / 2);
            out.push([x + u * c - w * sn, y + u * sn + w * c, F + 0.5]);
          }
    else
      for (const sx of [-1, 1])
        for (const yy of [-1.85, -1.6, -1.35, 1.55, 1.8, 2.05]) out.push([x + sx * 1.6, y + yy, F + 0.5]);
    return out;
  }, [amd, x, y]);
  const sub = amd ? [2.0, 2.0] : [1.875, 2.25];
  const printSize: [number, number] = amd ? [3.3, 3.3] : [2.5, 4.08];
  return (
    <Assembly id="cpu">
      <Explode by={[0, 0, 6]} from={0.62} to={0.9} id="cpu">
        <Bx a={[x - sub[0], y - sub[1], F + 0.35]} b={[x + sub[0], y + sub[1], F + 0.47]} m={substrate} />
        <Fins size={[0.1, 0.06, 0.05]} positions={caps} m={amd ? M.pin : M.ceramic} />
        <G g={ihs} p={[x, y, F + 0.47]} m={M.steel} />
        <mesh position={[x, y, F + 0.775]} material={print} userData={{ noTint: true }}>
          <planeGeometry args={printSize} />
        </mesh>
      </Explode>
    </Assembly>
  );
}

/**
 * Crucial Pro DDR5-5600 (4 × 16 GB): 133.3 × 31.9 mm, matte black anodised aluminium spreaders over both faces,
 * 288 gold fingers (144 a side, 0.85 mm pitch) split by the off-centre key notch, latch notches at both ends.
 * Each stick stands on its edge in a slot: length along y, height along z, thickness along x.
 */
const DDR = { L: 13.33, H: 3.19, y0: 31.835, z0: F + 0.35, pcb: 0.12, spreader: 0.25, finger: 0.37, key: 6.08 };
function ramLabel() {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e9e9e9";
  g.textBaseline = "alphabetic";
  g.font = "700 104px Arial, sans-serif";
  g.fillText("crucial", 64, 196);
  g.font = "500 30px Arial, sans-serif";
  g.fillStyle = "#b9b9b9";
  g.fillText("by micron", 214, 236);
  g.font = "600 64px Arial, sans-serif";
  g.fillStyle = "#e9e9e9";
  g.textAlign = "right";
  g.fillText("DDR5 Pro", 1536, 184);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function Ram() {
  const { L, H, pcb, spreader, finger, key } = DDR;
  // the spreader outline in (y, z) with the latch notches at both ends
  const shell = memo("ddr5-shell", () => {
    const b = finger + 0.2;
    const n0 = b + 0.62;
    const n1 = n0 + 0.34;
    return extrude(polyShape([[0, b], [L, b], [L, n0], [L - 0.16, n0 + 0.06], [L - 0.16, n1 - 0.06], [L, n1], [L, H - 0.1], [L - 0.1, H], [0.1, H], [0, H - 0.1], [0, n1], [0.16, n1 - 0.06], [0.16, n0 + 0.06], [0, n0]]), spreader * 2 + pcb, 0.03, 4, true);
  });
  const label = useMemo(() => new THREE.MeshBasicMaterial({ map: ramLabel(), transparent: true, depthWrite: false }), []);
  const fingers = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let k = 0; k < 144; k++) {
      let y = 0.33 + k * 0.085;
      if (y > key - 0.12) y += 0.24;
      if (y > L - 0.3) break;
      for (const side of [-1, 1]) out.push([side * (pcb / 2 + 0.002), y, finger / 2 + 0.03]);
    }
    return out;
  }, [L, key, pcb, finger]);
  return (
    <Assembly id="ram">
      {DIMM_X.map((x, i) => (
        <group key={x}>
          {/* slot and latches stay on the board */}
          <Bx a={[x - 0.38, 31.8, F]} b={[x + 0.38, 45.2, F + 0.85]} m={M.chip} />
          <Bx a={[x - 0.4, 45.2, F]} b={[x + 0.4, 45.8, F + 1.15]} m={M.grey} />
          <Bx a={[x - 0.4, 31.3, F]} b={[x + 0.4, 31.8, F + 0.95]} m={M.chip} />
          <Explode by={[0, 0, 7]} from={0.5 + i * 0.04} to={0.76 + i * 0.04} id={`ram${i}`}>
            <group position={[x, DDR.y0, DDR.z0]}>
              {/* green PCB with its gold fingers and the key notch, showing below the spreader */}
              <Bx a={[-pcb / 2, 0, 0]} b={[pcb / 2, key - 0.1, finger + 0.24]} m={M.pcb} />
              <Bx a={[-pcb / 2, key + 0.1, 0]} b={[pcb / 2, L, finger + 0.24]} m={M.pcb} />
              <Bx a={[-pcb / 2, key - 0.1, 0.12]} b={[pcb / 2, key + 0.1, finger + 0.24]} m={M.pcb} />
              <Fins size={[0.004, 0.06, finger - 0.06]} positions={fingers} m={M.pin} />
              {/* black aluminium spreader over both faces */}
              <G g={shell} p={[0, 0, 0]} rot={[Math.PI / 2, Math.PI / 2, 0]} m={M.black} threshold={35} />
              {[1, -1].map((sd) => (
                <mesh key={sd} position={[sd * (pcb / 2 + spreader + 0.035), L / 2, finger + 0.2 + (H - finger - 0.2) * 0.52]} rotation={[Math.PI / 2, (sd * Math.PI) / 2, 0]} material={label} userData={{ noTint: true }}>
                  <planeGeometry args={[L * 0.94, (L * 0.94) / 5]} />
                </mesh>
              ))}
            </group>
          </Explode>
        </group>
      ))}
    </Assembly>
  );
}

export function Board({ look }: { look: BoardLook }) {
  return (
    <Assembly id="board">
      <Body id="board">
        <Pcb look={look} />
        <Socket socket={look.socket} />
        <MountHoles socket={look.socket} />
      </Body>
    </Assembly>
  );
}
