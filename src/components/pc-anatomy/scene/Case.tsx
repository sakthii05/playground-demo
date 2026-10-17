"use client";
// The case: a white mid-tower with a glass side and a glass front, a slatted top over the radiator,
// a PSU cover across the bottom, angled feet, and the top I/O with the power button.
// World: x back (−23) → front (+23), y up (0 → 50), z tray (−11.5) → glass (+11.5). Units: cm.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { circle, extrude, memo, plate, polyShape, rectPath, roundedRect } from "./geo";
import { Body, Bx, Cy, Explode, Fins, G, INK, M, useLive } from "./kit";

export const CASE = { x0: -23, x1: 23, y0: 0, y1: 50, z0: -11.5, z1: 11.5, floor: 2.0, roof: 49.4, back: -22.4, tray: -10.9, shroud: 11.5 };
// expansion slot centres on the back panel (2.032 cm pitch); the GPU bracket covers the first two
export const SLOTS = Array.from({ length: 7 }, (_, k) => 29.7 - 2.032 * k);

function BackPanel() {
  const g = memo("backpanel", () => {
    const s = roundedRect(new THREE.Shape(), CASE.z0, CASE.floor, CASE.z1 - CASE.z0, CASE.roof - CASE.floor, 0);
    s.holes.push(circle(1.5, 37.5, 5.75, true));
    s.holes.push(rectPath(-10.6, 31.8, 4.0, 15.6, 0.2));
    for (const c of SLOTS) s.holes.push(rectPath(-7.6, c - 0.72, 11.8, 1.44, 0.15));
    s.holes.push(rectPath(-10.5, 2.4, 14.8, 8.0, 0.3));
    return extrude(s, 0.6, 0, 48);
  });
  const grill = memo("rear-grill", () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 5.75, 0, Math.PI * 2, false);
    s.holes.push(circle(0, 0, 5.45, true));
    return extrude(s, 0.2, 0, 64, true);
  });
  return (
    <group>
      <mesh geometry={g} material={M.shell} position={[CASE.back, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <Edges threshold={20} color={INK} />
      </mesh>
      {/* fan guard rings and spokes over the rear fan opening */}
      {[5.6, 4.0, 2.4].map((r, i) => (
        <mesh key={r} geometry={grill} material={M.shell} position={[-22.98, 37.5, 1.5]} rotation={[0, Math.PI / 2, 0]} scale={[r / 5.75, r / 5.75, 1]}>
          {i === 0 && <Edges threshold={20} color={INK} />}
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Bx key={i} a={[-23.0, 37.5 - 0.12, 1.5 - 5.6]} b={[-22.8, 37.5 + 0.12, 1.5 + 5.6]} rot={[(i * Math.PI) / 4, 0, 0]} m={M.shell} e={false} />
      ))}
      {/* expansion slot covers 3–7 with vents and thumbscrews */}
      {SLOTS.slice(2).map((c) => (
        <group key={c}>
          <Bx a={[-22.98, c - 0.7, -7.55]} b={[-22.82, c + 0.7, 4.15]} m={M.shell} />
          <Fins size={[0.05, 0.9, 0.35]} positions={Array.from({ length: 12 }, (_, i) => [-23.0, c, -6.5 + i * 0.85] as [number, number, number])} m={M.slot} />
          <Cy p={[-23.15, c, -8.4]} r={0.32} h={0.3} axis="x" m={M.steel} seg={16} />
        </group>
      ))}
      <Bx a={[-23.0, 17, -9.0]} b={[-22.8, 31.2, -7.8]} m={M.shell} />
      {/* side-panel thumbscrews */}
      {[12, 42].map((y) => (
        <Cy key={y} p={[-23.2, y, 10.6]} r={0.45} h={0.4} axis="x" m={M.steel} seg={20} />
      ))}
    </group>
  );
}

function TopIO() {
  const live = useLive();
  const ring = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const k = Math.min(1, live.current.level * 1.6);
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * k;
    void ring;
  });
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#7fd0ff", transparent: true, opacity: 0, depthWrite: false }), []);
  const y = CASE.y1;
  const at = (x: number, z: number): [number, number, number] => [x, y, z];
  return (
    <group>
      {/* power button: chrome-ringed, lit, and clickable */}
      <group
        onClick={(e) => {
          if (e.delta > 6) return;
          e.stopPropagation();
          live.current.togglePower();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          live.current.hover("power");
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          live.current.hover(null);
        }}
      >
        {/* a generous invisible hit area, so the small button is easy to tap */}
        <mesh position={[21.0, y + 0.6, 8.0]} visible={false}>
          <boxGeometry args={[3.4, 1.4, 3.4]} />
        </mesh>
        <Cy p={[21.0, y + 0.06, 8.4]} r={1.4} h={0.12} m={M.soft} seg={48} />
        <mesh ref={ring} position={[21.0, y + 0.15, 8.4]} rotation={[-Math.PI / 2, 0, 0]} material={M.led} userData={{ noTint: true }}>
          <ringGeometry args={[1.06, 1.24, 56]} />
        </mesh>
        <Cy p={[21.0, y + 0.27, 8.4]} r={1.0} h={0.42} m={M.white} seg={48} />
        <mesh position={[21.0, y + 0.49, 8.4]} rotation={[-Math.PI / 2, 0, 0]} material={M.led} userData={{ noTint: true }}>
          <ringGeometry args={[0.3, 0.4, 32, 1, Math.PI * 0.62, Math.PI * 1.76]} />
        </mesh>
        <mesh position={[21.0, y + 0.49, 8.4 - 0.3]} rotation={[-Math.PI / 2, 0, 0]} material={M.led} userData={{ noTint: true }}>
          <planeGeometry args={[0.1, 0.42]} />
        </mesh>
        <mesh ref={halo} position={[21.0, y + 0.16, 8.4]} rotation={[-Math.PI / 2, 0, 0]} material={haloMat} userData={{ noTint: true }}>
          <ringGeometry args={[1.24, 2.4, 56]} />
        </mesh>
      </group>
      {/* reset, USB-C, 2 × USB-A, audio */}
      <Cy p={[21.0, y + 0.08, 6.2]} r={0.3} h={0.16} m={M.soft} seg={20} />
      <Bx a={[20.6, y - 0.05, 3.3]} b={[21.4, y + 0.06, 4.3]} m={M.dark} />
      <Bx a={[20.55, y - 0.05, 0.8]} b={[21.45, y + 0.06, 2.3]} m={M.dark} />
      <Bx a={[20.55, y - 0.05, -1.4]} b={[21.45, y + 0.06, 0.1]} m={M.dark} />
      <Bx a={[20.95, y + 0.06, 1.0]} b={[21.05, y + 0.08, 2.1]} m={M.steel} e={false} />
      <Bx a={[20.95, y + 0.06, -1.2]} b={[21.05, y + 0.08, -0.1]} m={M.steel} e={false} />
      <Cy p={[21.0, y + 0.02, -3.2]} r={0.24} h={0.12} m={M.dark} seg={20} />
      {void at}
    </group>
  );
}

function TopPanel() {
  const g = memo("toppanel", () => {
    const s = roundedRect(new THREE.Shape(), CASE.x0, CASE.z0, CASE.x1 - CASE.x0, CASE.z1 - CASE.z0, 0.5);
    s.holes.push(rectPath(-20.4, -4.6, 39.0, 13.2, 0.7));
    return extrude(s, 0.6, 0.05, 24);
  });
  const slats = useMemo(() => Array.from({ length: 70 }, (_, i) => [-20.0 + i * 0.555, 49.72, 2.0] as [number, number, number]), []);
  return (
    <group>
      <mesh geometry={g} material={M.shell} position={[0, CASE.y1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Edges threshold={20} color={INK} />
      </mesh>
      <Fins size={[0.2, 0.4, 13.0]} positions={slats} m={M.white} />
      <Bx a={[-20.4, 49.5, -4.6]} b={[18.6, 49.9, -4.4]} m={M.shell} e={false} />
      <TopIO />
    </group>
  );
}

function FrontPanel() {
  const frame = memo("frontframe-v2", () => {
    const s = roundedRect(new THREE.Shape(), CASE.z0, CASE.y0 + 2.0, CASE.z1 - CASE.z0, CASE.y1 - 2.0, 0.6);
    // solid below the PSU-cover line, so the power supply chamber is hidden from the front
    s.holes.push(rectPath(-10.2, 12.4, 20.4, 36.2, 0.9));
    return extrude(s, 0.8, 0.08, 32);
  });
  return (
    <group>
      <mesh geometry={frame} material={M.shell} position={[22.2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Edges threshold={20} color={INK} />
      </mesh>
      <Bx a={[22.45, 12.5, -10.1]} b={[22.7, 48.5, 10.1]} m={M.glass} />
    </group>
  );
}

/** The side glass slides off and fades, so it never stands between you and the parts. */
function SideGlass() {
  const live = useLive();
  const mat = useMemo(() => (M.glass as THREE.MeshLambertMaterial).clone(), []);
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const k = Math.min(1, Math.max(0, live.current.t / 0.3));
    const e = k * k * (3 - 2 * k);
    mat.opacity = 0.1 * (1 - e);
    if (ref.current) {
      ref.current.visible = e < 0.999;
      ref.current.position.z = 9 * e;
      ref.current.traverse((o) => {
        const line = o as THREE.LineSegments;
        if (line.isLineSegments) (line.material as THREE.LineBasicMaterial).opacity = 1 - e;
      });
    }
  });
  return (
    <group ref={ref}>
      <mesh position={[-0.1, 25.7, 11.23]} material={mat} userData={{ noTint: true }}>
        <boxGeometry args={[44.4, 46.4, 0.34]} />
        <Edges threshold={20} color={INK} transparent />
      </mesh>
    </group>
  );
}

/** The PSU cover's top: vent slots cut right through, and the grommet hole the GPU cable drops into. */
function ShroudTop() {
  const g = memo("shroudtop", () => {
    const s = roundedRect(new THREE.Shape(), CASE.back, CASE.tray, 22.2 - CASE.back, 11.0 - CASE.tray, 0);
    for (let i = 0; i < 22; i++) s.holes.push(rectPath(8.45, -8.56 + i * 0.8, 6.6, 0.32, 0.16));
    s.holes.push(rectPath(-5.6, 7.5, 2.8, 2.2, 0.9));
    return extrude(s, 0.5, 0, 16);
  });
  const ring = memo("shroudgrommet", () => {
    const s = roundedRect(new THREE.Shape(), -5.95, 7.15, 3.5, 2.9, 1.2);
    s.holes.push(rectPath(-5.6, 7.5, 2.8, 2.2, 0.9));
    return extrude(s, 0.16, 0.03, 16);
  });
  return (
    <group>
      <G g={g} p={[0, CASE.shroud, 0]} rot={[Math.PI / 2, 0, 0]} m={M.shell} />
      <G g={ring} p={[0, CASE.shroud + 0.16, 0]} rot={[Math.PI / 2, 0, 0]} m={M.rubber} />
    </group>
  );
}

/** The PSU cover's side: a row of vent slots cut through it. */
function ShroudSide() {
  const g = memo("shroudside", () => {
    const s = roundedRect(new THREE.Shape(), CASE.back, CASE.floor, 22.2 - CASE.back, 11.0 - CASE.floor, 0);
    for (let i = 0; i < 14; i++) s.holes.push(rectPath(8.44 + i * 0.85, 5.0, 0.32, 3.6, 0.16));
    return extrude(s, 0.6, 0, 16);
  });
  return <G g={g} p={[0, 0, 10.4]} m={M.shell} />;
}

function Chassis() {
  const foot = memo("foot", () => extrude(polyShape([[-1.7, 0], [1.7, 0], [2.4, 1.4], [-2.4, 1.4]]), 2.6, 0.08, 4, true));

  return (
    <group>
      {[-19.5, 19.5].map((x) =>
        [-8.6, 8.6].map((z) => (
          <group key={`${x}${z}`}>
            <G g={foot} p={[x, 0.08, z]} m={M.shell} />
            <Bx a={[x - 1.6, 0, z - 1.1]} b={[x + 1.6, 0.1, z + 1.1]} m={M.rubber} e={false} />
          </group>
        )),
      )}
      <Bx a={[CASE.x0, 1.4, CASE.z0]} b={[CASE.x1, CASE.floor, CASE.z1]} m={M.shell} />
      <Bx a={[CASE.back, CASE.floor, CASE.z0]} b={[22.2, CASE.roof, CASE.tray]} m={M.tray} />
      {/* PSU cover */}
      <Body id="shroud">
        <ShroudTop />
        <ShroudSide />
      </Body>
      <Bx a={[-21.0, 3.4, 11.0]} b={[-3.6, 9.6, 11.12]} m={M.soft} />

      {/* tray grommets beside the board for the 24-pin, and above it for the CPU cable */}
      <Bx a={[5.0, 19.5, CASE.tray + 0.02]} b={[7.0, 44.5, CASE.tray + 0.14]} m={M.rubber} />
      <Bx a={[5.9, 19.8, CASE.tray + 0.14]} b={[6.1, 44.2, CASE.tray + 0.17]} m={M.dark} e={false} />
      <Bx a={[-21.0, 48.2, CASE.tray + 0.02]} b={[-11.5, 49.2, CASE.tray + 0.14]} m={M.rubber} />
      {/* cut-out with a grommet behind the front fans, for their cables */}
      <Bx a={[16.6, 12.2, CASE.tray + 0.02]} b={[18.4, 15.4, CASE.tray + 0.14]} m={M.rubber} />
      <Bx a={[17.45, 12.5, CASE.tray + 0.14]} b={[17.55, 15.1, CASE.tray + 0.17]} m={M.dark} e={false} />
      {/* fan rails behind the front glass */}
      <Bx a={[21.9, 11.6, -6.6]} b={[22.2, 48.6, -5.9]} m={M.shell} />
      <Bx a={[21.9, 11.6, 5.9]} b={[22.2, 48.6, 6.6]} m={M.shell} />
      {/* rails the side glass sits in */}
      <Body id="rails">
        <Bx a={[CASE.back, CASE.floor, 11.0]} b={[22.2, 2.4, 11.5]} m={M.shell} />
        <Bx a={[CASE.back, 49.0, 10.9]} b={[22.2, CASE.roof, 11.5]} m={M.shell} />
      </Body>
    </group>
  );
}

export function Case() {
  return (
    <group>
      <Chassis />
      <Body id="back">
        <BackPanel />
      </Body>
      <Explode by={[0, 26, 0]} from={0} to={0.28} id="top">
        <TopPanel />
      </Explode>
      <Explode by={[9, 0, 0]} from={0} to={0.28} id="front">
        <FrontPanel />
      </Explode>
      <SideGlass />
    </group>
  );
}

void plate;
