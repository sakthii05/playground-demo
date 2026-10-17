"use client";
// The 850 W ATX 3.1 power supply under its cover, and the sleeved cables in their real pin layouts:
// 24-pin (2 × 12) to the board, 2 × EPS 8-pin (2 × 4) to the CPU power stages, both into the tray
// grommets on their way round the back to the PSU; and the 12V-2×6 (2 × 6 + 2 sense wires) from the
// graphics card through the grommet in the PSU cover to the PSU's own 12V-2×6 socket. The GPU cable is
// rebuilt as the card and the PSU come apart, so it stays plugged in at both ends.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { extrude, grid, harness, roundedRect } from "./geo";
import { Assembly, Body, Bx, Explode, Fins, G, INK, M, useLive, window01 } from "./kit";
import { F } from "./Board";
import { gpuMatrix, gpuPlugs, type GpuLook } from "./Gpu";

type V3 = [number, number, number];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
// the grommet in the PSU cover the graphics cable drops through (see Case.tsx)
export const GROMMET_X = -4.2;
const PSU = { x0: -22.95, x1: -6.95, y0: 2.5, y1: 10.3, z0: -10.4, z1: 4.2 };
export const PSU_WINDOW = { from: 0.4, to: 0.7, by: -13 };
const psuShift = (t: number) => PSU_WINDOW.by * window01(t, PSU_WINDOW.from, PSU_WINDOW.to);
// the GPU cable's plugs in the PSU: their back faces, where the wires leave (+x). NVIDIA: one 12V-2×6;
// AMD: two PCIe 8-pin.
const psuPlugs = (look: GpuLook) => (look.brand === "AMD" ? [v(PSU.x1 + 1.45, 7.75, -1.7), v(PSU.x1 + 1.45, 7.75, 1.6)] : [v(PSU.x1 + 1.45, 7.75, 1.6)]);

export function Psu({ look }: { look: GpuLook }) {
  const body = useMemo(() => extrude(roundedRect(new THREE.Shape(), PSU.z0, PSU.y0, PSU.z1 - PSU.z0, PSU.y1 - PSU.y0, 0.5), PSU.x1 - PSU.x0, 0.08, 12), []);
  const grill = useMemo(() => {
    const out: V3[] = [];
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 15; c++) {
        const z = -9.6 + c * 0.62 + (r % 2 ? 0.31 : 0);
        const y = 3.3 + r * 0.66;
        if (z < -1.0) out.push([PSU.x0 - 0.01, y, z]);
      }
    return out;
  }, []);
  return (
    <Assembly id="psu">
      <Explode by={[PSU_WINDOW.by, 0, 0]} from={PSU_WINDOW.from} to={PSU_WINDOW.to} id="psu">
        <G g={body} p={[PSU.x1, 0, 0]} rot={[0, -Math.PI / 2, 0]} m={M.dark} threshold={30} />
        {/* rear: honeycomb grille, IEC inlet and switch (seen through the back panel) */}
        <Fins size={[0.04, 0.42, 0.42]} positions={grill} m={M.black} />
        <Bx a={[PSU.x0 - 0.05, 6.4, 0.2]} b={[PSU.x0 + 0.1, 9.4, 3.2]} m={M.black} />
        {[0.9, 1.7, 2.5].map((z, i) => (
          <Bx key={z} a={[PSU.x0 - 0.06, i === 1 ? 8.1 : 7.4, z - 0.12]} b={[PSU.x0 - 0.02, i === 1 ? 8.9 : 8.2, z + 0.12]} m={M.steel} e={false} />
        ))}
        <Bx a={[PSU.x0 - 0.12, 3.4, 0.6]} b={[PSU.x0, 5.4, 2.0]} m={M.black} />
        <Bx a={[PSU.x0 - 0.2, 4.4, 0.75]} b={[PSU.x0 - 0.1, 5.25, 1.85]} m={M.slot} e={false} />
        {/* front: modular sockets (24-pin, 2 × CPU, PCIe), the 12V-2×6 socket in use */}
        {[[3.4, -9.4, 5.8], [3.4, -3.0, 2.6], [3.4, 0.2, 2.6], [6.6, -9.4, 5.8], [6.6, -3.0, 2.6]].map(([y, z, w]) => (
          <group key={`${y}${z}`}>
            <Bx a={[PSU.x1, y, z]} b={[PSU.x1 + 0.08, y + 2.2, z + w]} m={M.black} />
            <Fins size={[0.04, 0.5, 0.5]} positions={Array.from({ length: Math.round(w / 0.65) * 2 }, (_, i) => [PSU.x1 + 0.09, y + (i % 2 ? 1.5 : 0.7), z + 0.4 + Math.floor(i / 2) * 0.65] as V3)} m={M.slot} />
          </group>
        ))}
        <Bx a={[PSU.x1, 6.8, 0.4]} b={[PSU.x1 + 0.08, 8.7, 2.8]} m={M.black} />
        {/* the GPU cable's plugs, seated, with their latches */}
        {psuPlugs(look).map((p) => (
          <group key={p.z}>
            <Bx a={[PSU.x1 + 0.08, 7.05, p.z - 1.05]} b={[PSU.x1 + 1.45, 8.45, p.z + 1.05]} m={M.black} />
            <Bx a={[PSU.x1 + 0.4, 8.45, p.z - 0.4]} b={[PSU.x1 + 1.0, 8.62, p.z + 0.4]} m={M.black} />
          </group>
        ))}
        {/* label on the glass side */}
        <Bx a={[-20.4, 4.0, PSU.z1]} b={[-9.4, 8.8, PSU.z1 + 0.04]} m={M.soft} />
        <Bx a={[-19.6, 7.6, PSU.z1 + 0.04]} b={[-14.0, 7.9, PSU.z1 + 0.06]} m={M.dark} e={false} />
        <Bx a={[-19.6, 6.8, PSU.z1 + 0.04]} b={[-12.4, 7.0, PSU.z1 + 0.06]} m={M.grey} e={false} />
        <Bx a={[-19.6, 6.2, PSU.z1 + 0.04]} b={[-15.2, 6.4, PSU.z1 + 0.06]} m={M.grey} e={false} />
      </Explode>
    </Assembly>
  );
}

/** A static harness: strands from `layout` along `points`, inked. */
export function Harness({ points, layout, r, up, m = M.cable }: { points: THREE.Vector3[]; layout: [number, number][]; r: number; up?: THREE.Vector3; m?: THREE.Material }) {
  const geos = useMemo(() => harness(points, layout, r, { up }), [points, layout, r, up]);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={m}>
          <Edges threshold={70} color={INK} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The graphics card's power cable, plugged into the card at one end and the PSU at the other: one 12V-2×6
 * (twelve power wires and two sense wires) for NVIDIA cards, two PCIe 8-pin cables for the AMD cards.
 */
function GpuCable({ look }: { look: GpuLook }) {
  const live = useLive();
  const last = useRef(-1);
  const meshes = useRef<THREE.Mesh[]>([]);
  const plugs = useMemo(() => gpuPlugs(look), [look]);
  const ends = psuPlugs(look);
  const layouts = useMemo(() => plugs.map((p) => (p.pins === "8pin" ? grid(4, 2, 0.42) : [...grid(6, 2, 0.3), [-0.25, 0.44] as [number, number], [0.25, 0.44] as [number, number]])), [plugs]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const build = (t: number) => {
    gpuMatrix(t, m, look.family);
    const across = new THREE.Vector3(1, 0, 0).transformDirection(m);
    return plugs.flatMap((p, i) => {
      const plug = p.at.clone().applyMatrix4(m);
      const out = p.dir.clone().transformDirection(m);
      const psu = ends[i].clone().add(v(psuShift(t), 0, 0));
      const lane = (i - (plugs.length - 1) / 2) * 0.9;
      // straight out of the back of the plug first (strain relief), then a wide bend down past the card
      const lead = (k: number) => plug.clone().add(out.clone().multiplyScalar(k));
      const end = lead(2.0);
      // bend radius ≈ 2 cm: up and out of the plug, over, then down beside the card
      // out of the plug, then a wide arc off to the front of the case, and down beside the card — so the
      // run never hangs in front of the plug and the plug stays in plain view
      const side = 3.4;
      const arc = v(plug.x + side * 0.45, end.y + 0.15, end.z + 0.9);
      const turn = v(plug.x + side * 0.9, end.y - 1.2, Math.max(end.z + 1.3, plug.z + 2.2));
      const drop = v(plug.x + side, end.y - 3.4, Math.max(turn.z + 0.3, 9.4));
      const gx = GROMMET_X + lane;
      const pts = [plug, lead(0.6), lead(1.3), end, arc, turn, drop, v(drop.x + (gx - drop.x) * 0.5, 17.0, Math.max(drop.z, 9.4)), v(gx, 14.2, Math.max(9.0, Math.min(drop.z, 10.2))), v(gx, 12.6, 8.7), v(gx, 11.6, 8.6), v(gx, 10.4, 8.4), v(gx - 0.6, 8.6, Math.min(5.0, psu.z + 3.4)), v(psu.x + 1.6, psu.y, psu.z + 0.6), v(psu.x + 0.4, psu.y, psu.z), psu];
      return harness(pts, layouts[i], 0.125, { up: across, segments: 110, radial: 6 });
    });
  };
  useFrame(() => {
    const t = live.current.t;
    if (t === last.current) return;
    last.current = t;
    build(t).forEach((g, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.geometry.dispose();
      mesh.geometry = g;
    });
  });
  const initial = useMemo(() => build(0), []); // eslint-disable-line react-hooks/exhaustive-deps
  const sense = new Set<number>();
  let n = 0;
  layouts.forEach((l, i) => {
    if (plugs[i].pins === "12v2x6") [12, 13].forEach((k) => sense.add(n + k));
    n += l.length;
  });
  return (
    <group>
      {initial.map((g, i) => (
        <mesh key={i} ref={(el) => void (el && (meshes.current[i] = el))} material={sense.has(i) ? M.dark : M.cable} geometry={g} />
      ))}
    </group>
  );
}

export function Cables({ look }: { look: GpuLook }) {
  const zUp = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  // 24-pin: out of the plug, into the tray grommet beside the board
  const atx = useMemo(() => [v(4.45, 36.7, F + 0.6), v(5.25, 36.7, F + 0.55), v(5.95, 36.7, -10.1), v(6.0, 36.7, -10.85)], []);
  const atxLayout = useMemo(() => grid(2, 12, 0.42), []); // 2 rows across the board face, 12 along the plug
  const eps = (x: number) => [v(x, 48.7, F + 0.55), v(x, 49.08, F + 0.15), v(x, 49.0, -10.45), v(x, 48.75, -10.85)];
  const epsA = useMemo(() => eps(-16.2), []);
  const epsB = useMemo(() => eps(-13.7), []);
  const epsLayout = useMemo(() => grid(2, 4, 0.42), []); // 2 rows, 4 along the plug
  return (
    <Assembly id="cables">
      {/* 24-pin plug with its latch, then the 24 wires */}
      <Bx a={[2.8, 33.9, F]} b={[4.45, 39.5, F + 1.2]} m={M.black} />
      <Bx a={[2.95, 36.2, F + 1.2]} b={[3.9, 37.2, F + 1.4]} m={M.black} />
      <Harness points={atx} layout={atxLayout} r={0.17} up={zUp} />
      {/* CPU power plugs on top of the EPS headers, latches facing the glass */}
      {[-16.2, -13.7].map((x) => (
        <group key={x}>
          <Bx a={[x - 1.0, 47.75, F]} b={[x + 1.0, 48.7, F + 1.1]} m={M.black} />
          <Bx a={[x - 0.35, 47.95, F + 1.1]} b={[x + 0.35, 48.45, F + 1.28]} m={M.black} />
        </group>
      ))}
      <Harness points={epsA} layout={epsLayout} r={0.16} up={zUp} />
      <Harness points={epsB} layout={epsLayout} r={0.16} up={zUp} />
      <Body id="gpucable">
        <GpuCable key={look.family + look.brand} look={look} />
      </Body>
    </Assembly>
  );
}
