"use client";
// 120 mm case fans and the RTX 5080's ringed 7-blade fans. Rotors spin from the live power level:
// they spin up and coast down, and a soft disc fades in as the blades blur.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { fanBlades, fanFrame, memo } from "./geo";
import { INK, M, useLive } from "./kit";

type V3 = [number, number, number];
const MAX_RPS = 3.1; // shown speed; the blur disc carries the rest of the impression of speed

function useSpin(count: number, dir = 1, phase = 0) {
  const live = useLive();
  const rotor = useRef<THREE.Group>(null);
  const blur = useRef<THREE.Mesh>(null);
  const angle = useRef(phase);
  useFrame((_, dt) => {
    const lv = live.current.level;
    const load = live.current.temps?.load ?? 0;
    const step = Math.min(lv * (0.55 + 0.45 * load) * MAX_RPS * Math.PI * 2 * Math.min(dt, 0.05), (0.45 * Math.PI * 2) / count);
    angle.current += step * dir;
    if (rotor.current) rotor.current.rotation.z = angle.current;
    if (blur.current) (blur.current.material as THREE.MeshBasicMaterial).opacity = 0.62 * Math.max(0, lv - 0.25) / 0.75;
  });
  return { rotor, blur };
}

/** A 120 × 120 × 25 mm fan, axis along local z; air leaves through +z (the strut side). */
export function CaseFan({ p, rot, size = 12, depth = 2.5, count = 9, dir = 1, phase = 0 }: { p: V3; rot?: V3; size?: number; depth?: number; count?: number; dir?: number; phase?: number }) {
  const { rotor, blur } = useSpin(count, dir, phase);
  const throat = size * 0.485;
  const hub = size * 0.17;
  const blades = fanBlades({ hub: hub + 0.02, tip: throat - 0.16, count, depth: depth * 0.72, sweep: 0.62 });
  const blurMat = useMemo(() => M.blur.clone(), []);
  const ring = memo(`blurring:${hub}:${throat}`, () => new THREE.RingGeometry(hub, throat - 0.12, 64));
  const strut = memo(`strut:${throat}:${hub}`, () => new THREE.BoxGeometry(throat - hub, 0.34, 0.5));
  const pads = useMemo(() => {
    const k = size / 2 - 0.75;
    return [[-k, -k], [k, -k], [k, k], [-k, k]] as [number, number][];
  }, [size]);
  return (
    <group position={p} rotation={rot}>
      <mesh geometry={fanFrame(size, depth, throat)} material={M.white}>
        <Edges threshold={25} color={INK} />
      </mesh>
      {/* rubber corner pads, both faces */}
      {pads.map(([x, y]) =>
        [-1, 1].map((s) => (
          <mesh key={`${x}${y}${s}`} position={[x, y, s * (depth / 2 + 0.04)]} material={M.soft}>
            <boxGeometry args={[1.25, 1.25, 0.08]} />
          </mesh>
        )),
      )}
      {/* motor bracket: four struts and the motor cup on the exhaust side */}
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const r = (throat + hub) / 2;
        return (
          <mesh key={i} geometry={strut} material={M.white} position={[Math.cos(a) * r, Math.sin(a) * r, depth / 2 - 0.25]} rotation={[0, 0, a]}>
            <Edges threshold={25} color={INK} />
          </mesh>
        );
      })}
      <mesh position={[0, 0, depth / 2 - 0.3]} rotation={[Math.PI / 2, 0, 0]} material={M.white}>
        <cylinderGeometry args={[hub + 0.15, hub + 0.15, 0.6, 40]} />
        <Edges threshold={30} color={INK} />
      </mesh>
      {/* rotor */}
      <group ref={rotor}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.15]} material={M.white}>
          <cylinderGeometry args={[hub, hub, depth * 0.62, 40]} />
          <Edges threshold={30} color={INK} />
        </mesh>
        <mesh position={[0, 0, -depth * 0.31 - 0.16]} material={M.soft}>
          <circleGeometry args={[hub * 0.72, 40]} />
        </mesh>
        <mesh geometry={blades} material={M.blade}>
          <Edges threshold={35} color={INK} />
        </mesh>
      </group>
      <mesh ref={blur} geometry={ring} material={blurMat} position={[0, 0, -depth * 0.36]} userData={{ noTint: true }} />
    </group>
  );
}

/** The Founders Edition fan: 7 dark blades joined by an outer ring, no frame (the shroud is the frame). */
export function GpuFan({ p, rot, r = 5.6, depth = 1.6, dir = 1, count = 7, ring = true }: { p: V3; rot?: V3; r?: number; depth?: number; dir?: number; count?: number; ring?: boolean }) {
  const { rotor, blur } = useSpin(count, dir);
  const hub = Math.max(1.3, r * 0.31);
  const blades = fanBlades({ hub: hub + 0.02, tip: r - (ring ? 0.32 : 0.12), count, depth: depth * 0.9, sweep: count > 8 ? 0.55 : 0.7, rootChord: count > 8 ? 0.85 : 0.9, tipChord: count > 8 ? 0.72 : 0.8, thick: 0.08 });
  const ringGeo = memo(`gpuring:${r}:${depth}`, () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
    const h = new THREE.Path();
    h.absarc(0, 0, r - 0.34, 0, Math.PI * 2, true);
    s.holes.push(h);
    const g = new THREE.ExtrudeGeometry(s, { depth: depth * 0.55, bevelEnabled: false, curveSegments: 64 });
    g.translate(0, 0, -depth * 0.275);
    return g;
  });
  const blurMat = useMemo(() => M.blurDark.clone(), []);
  const disc = memo(`gpublur:${r}`, () => new THREE.RingGeometry(hub, r - 0.1, 64));
  return (
    <group position={p} rotation={rot}>
      <group ref={rotor}>
        <mesh geometry={blades} material={M.bladeDark}>
          <Edges threshold={35} color="#55585e" />
        </mesh>
        {ring && (
          <mesh geometry={ringGeo} material={M.dark}>
            <Edges threshold={30} color="#55585e" />
          </mesh>
        )}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={M.dark}>
          <cylinderGeometry args={[hub, hub, depth * 0.8, 40]} />
          <Edges threshold={30} color="#55585e" />
        </mesh>
        <mesh position={[0, 0, -depth * 0.41]} material={M.steel}>
          <circleGeometry args={[hub * 0.7, 40]} />
        </mesh>
      </group>
      <mesh ref={blur} geometry={disc} material={blurMat} position={[0, 0, -depth * 0.46]} userData={{ noTint: true }} />
    </group>
  );
}
