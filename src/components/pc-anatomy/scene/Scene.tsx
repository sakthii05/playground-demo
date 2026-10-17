"use client";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { BODIES, LiveContext, LiveDriver, useLive, type Live } from "./kit";
import { shadowTexture } from "./geo";
import { Case } from "./Case";
import { Board, Cpu, Ram, type BoardLook } from "./Board";
import { Gpu, type GpuLook } from "./Gpu";
import { Cooling } from "./Cooling";
import { Cables, Psu } from "./Power";

const TARGET = new THREE.Vector3(0, 25.5, 0);
const HOME = new THREE.Vector3(0.6, 0.23, 0.78).normalize();

/** Keeps the whole PC in frame for any aspect ratio, and backs off a little when it comes apart. */
function Framing() {
  const { camera, size } = useThree();
  const controls = useThree((st) => st.controls) as unknown as OrbitImpl | null;
  const live = useLive();
  useFrame(() => {
    if (live.current.pinnedView) return;
    const cam = camera as THREE.PerspectiveCamera;
    // slide the picture left (a view offset, so orbiting is unchanged) while the overlay is open
    const sh = (live.current.shifted ?? 0) + ((live.current.shift ?? 0) - (live.current.shifted ?? 0)) * 0.08;
    live.current.shifted = sh;
    const px = sh * Math.min(220, size.width * 0.17);
    if (Math.abs(px) > 0.5) cam.setViewOffset(size.width, size.height, px, 0, size.width, size.height);
    else if (cam.view) cam.clearViewOffset();
    const aspect = size.width / Math.max(1, size.height);
    const half = THREE.MathUtils.degToRad(cam.fov / 2);
    const t = live.current.t;
    const h = 31 + 22 * t; // half height to fit (the roof lifts well clear)
    const w = 33 + 15 * t; // half width to fit
    const want = Math.max(h / Math.tan(half), w / (Math.tan(half) * aspect)) / live.current.zoomed;
    // zoomed in, you can pan (right-drag, two fingers); the point you look at stays inside the case,
    // and drifts back to the middle as you zoom out
    const tgt = controls?.target ?? TARGET;
    const zoomedIn = live.current.zoomed > 1.04;
    if (controls) controls.enablePan = zoomedIn;
    const pull = zoomedIn ? 0 : 0.08;
    tgt.set(
      THREE.MathUtils.clamp(tgt.x + (TARGET.x - tgt.x) * pull, -21, 21),
      THREE.MathUtils.clamp(tgt.y + (TARGET.y - tgt.y) * pull, 6, 47),
      THREE.MathUtils.clamp(tgt.z + (TARGET.z - tgt.z) * pull, -10, 14),
    );
    const off = cam.position.clone().sub(tgt);
    const d = off.length();
    off.setLength(d + (want - d) * 0.12);
    cam.position.copy(tgt).add(off);
  });
  return null;
}

/** Preview options in the URL, for checking states: ?still&az=40&el=12&apart&power&pick=gpu */
function Preview() {
  const { camera } = useThree();
  const controls = useThree((st) => st.controls) as unknown as OrbitImpl | null;
  const live = useLive();
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("target")) {
      const [x, y, z] = (q.get("target") ?? "").split(",").map(Number);
      const cam = camera as THREE.PerspectiveCamera;
      cam.fov = Number(q.get("fov") ?? 8);
      cam.updateProjectionMatrix();
      TARGET.set(x, y, z);
      live.current.pinnedView = true;
    }
    if (q.has("az") || q.has("el")) {
      const az = THREE.MathUtils.degToRad(Number(q.get("az") ?? 52));
      const el = THREE.MathUtils.degToRad(Number(q.get("el") ?? 10));
      const d = live.current.pinnedView ? 170 : camera.position.distanceTo(TARGET);
      camera.position.set(TARGET.x + d * Math.cos(el) * Math.sin(az), TARGET.y + d * Math.sin(el), TARGET.z + d * Math.cos(el) * Math.cos(az));
      camera.lookAt(TARGET);
    }
    if (controls) {
      controls.target.copy(TARGET);
      controls.update();
    }
    if (q.has("apart")) {
      live.current.apart = true;
      live.current.t = Number(q.get("apart") || 1);
      live.current.pinned = true;
    }
    if (q.has("power")) {
      live.current.power = true;
      live.current.level = 1;
    }
    if (q.has("pick")) live.current.pick(q.get("pick"));
    if (q.has("still"))
      // Steps through the explode and lists mesh pairs from different bodies whose boxes overlap
      // at some point but not at rest: a part passing through another.
      (window as unknown as { __pcCheck: () => Promise<string[]> }).__pcCheck = async () => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const boxesAt = async (t: number) => {
          live.current.t = t;
          live.current.pinned = true;
          await frame();
          const out = new Map<string, { box: THREE.Box3; name: string; uid: string }[]>();
          for (const [id, obj] of BODIES) {
            obj.updateWorldMatrix(true, true);
            const list: { box: THREE.Box3; name: string; uid: string }[] = [];
            obj.traverse((o) => {
              const m = o as THREE.Mesh;
              if (!m.isMesh || !m.visible || (m.material as THREE.Material).transparent || m.geometry.type.startsWith("LineSegments")) return;
              const add = (b: THREE.Box3, k = "") => {
                b.expandByScalar(-0.04);
                if (!b.isEmpty()) list.push({ box: b, uid: m.uuid + k, name: `${m.geometry.type}@${b.getCenter(new THREE.Vector3()).toArray().map((v) => v.toFixed(1)).join(",")}` });
              };
              const pos = m.geometry.getAttribute("position");
              if (m.geometry.type === "TubeGeometry" && pos) {
                // a cable is checked in short pieces, not as one box round its whole route
                const ring = ((m.geometry as THREE.TubeGeometry).parameters.radialSegments ?? 8) + 1;
                const step = ring * 4;
                const p = new THREE.Vector3();
                for (let i = 0; i < pos.count; i += step) {
                  const b = new THREE.Box3();
                  for (let j = i; j < Math.min(pos.count, i + step + ring); j++) b.expandByPoint(p.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld));
                  add(b, `:${i}`);
                }
              } else if (pos) {
                // this mesh's own vertices only (setFromObject would also take in its outline lines)
                const b = new THREE.Box3();
                const p = new THREE.Vector3();
                const inst = m as unknown as THREE.InstancedMesh;
                if (inst.isInstancedMesh) {
                  const mi = new THREE.Matrix4();
                  for (let k = 0; k < inst.count; k++) {
                    inst.getMatrixAt(k, mi);
                    const mw = new THREE.Matrix4().multiplyMatrices(m.matrixWorld, mi);
                    const bi = new THREE.Box3();
                    for (let j = 0; j < pos.count; j++) bi.expandByPoint(p.fromBufferAttribute(pos, j).applyMatrix4(mw));
                    add(bi, `#${k}`);
                  }
                  return;
                }
                for (let j = 0; j < pos.count; j++) b.expandByPoint(p.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld));
                add(b);
              }
            });
            out.set(id, list);
          }
          return out;
        };
        const hits = (bx: Map<string, { box: THREE.Box3; name: string; uid: string }[]>) => {
          const ids = [...bx.keys()];
          const out = new Map<string, string>();
          for (let i = 0; i < ids.length; i++)
            for (let j = i + 1; j < ids.length; j++)
              for (const a of bx.get(ids[i])!) for (const b of bx.get(ids[j])!) if (a.box.intersectsBox(b.box)) out.set(a.uid + b.uid, `${ids[i]}:${a.name} × ${ids[j]}:${b.name}`);
          return out;
        };
        const base = hits(await boxesAt(0));
        const report = new Map<string, number[]>();
        for (let k = 1; k <= 50; k++) {
          const t = k / 50;
          for (const [key, label] of hits(await boxesAt(t))) if (!base.has(key)) report.set(q.has("full") ? label : label.replace(/@[^ ]+/g, "") + "|" + key.slice(0, 6), [...(report.get(q.has("full") ? label : label.replace(/@[^ ]+/g, "") + "|" + key.slice(0, 6)) ?? []), t]);
        }
        live.current.t = 0;
        return [...report].map(([pair, ts]) => `${pair} at t=${ts[0].toFixed(2)}–${ts[ts.length - 1].toFixed(2)}`);
      };
    if (q.has("still"))
      (window as unknown as { __pcBodies: (id: string) => string[] }).__pcBodies = (id) => {
        const out: string[] = [];
        BODIES.get(id)?.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const b = new THREE.Box3().setFromObject(m, true);
          out.push(`${m.geometry.type} [${b.min.toArray().map((v) => v.toFixed(1))}]→[${b.max.toArray().map((v) => v.toFixed(1))}]`);
        });
        return out;
      };
    if (q.has("still")) (window as unknown as { __pcProject: (x: number, y: number, z: number) => number[] }).__pcProject = (x, y, z) => {
      const p = new THREE.Vector3(x, y, z).project(camera);
      const r = (document.querySelector(".pca-canvas canvas") as HTMLCanvasElement).getBoundingClientRect();
      return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
    };
  }, [camera, live, controls]);
  return null;
}

function Controls() {
  const ref = useRef<OrbitImpl>(null);
  const still = typeof location !== "undefined" && new URLSearchParams(location.search).has("still");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <OrbitControls
      ref={ref as never}
      makeDefault
      target={TARGET}
      enablePan={false}
      screenSpacePanning
      panSpeed={0.7}
      enableZoom={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.7}
      autoRotate={!still}
      autoRotateSpeed={0.5}
      minPolarAngle={0.55}
      maxPolarAngle={1.62}
      onStart={() => {
        if (ref.current) ref.current.autoRotate = false;
        if (timer.current) clearTimeout(timer.current);
      }}
      onEnd={() => {
        timer.current = setTimeout(() => {
          if (ref.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current.autoRotate = true;
        }, 4500);
      }}
    />
  );
}

function Ground() {
  const map = useMemo(() => shadowTexture(), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} userData={{ noTint: true }}>
      <planeGeometry args={[78, 44]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  );
}

export interface Variant {
  gpuFamily: GpuLook["family"];
  gpuBrand: GpuLook["brand"];
  gpuName: string;
  socket: BoardLook["socket"];
  cpuName: string;
  cpuBrand: string;
  chipset: string;
  tier: BoardLook["tier"];
}

function Pc({ variant }: { variant: Variant }) {
  const gpu = useMemo<GpuLook>(() => ({ family: variant.gpuFamily, brand: variant.gpuBrand, name: variant.gpuName }), [variant.gpuFamily, variant.gpuBrand, variant.gpuName]);
  const board = useMemo<BoardLook>(() => ({ chipset: variant.chipset, tier: variant.tier, socket: variant.socket, cpuName: variant.cpuName, cpuBrand: variant.cpuBrand }), [variant.chipset, variant.tier, variant.socket, variant.cpuName, variant.cpuBrand]);
  return (
    <group>
      <Case />
      <Board key={`b${board.chipset}${board.tier}`} look={board} />
      <Cpu key={`c${board.cpuName}`} look={board} />
      <Ram />
      <Gpu key={`g${gpu.name}`} look={gpu} />
      <Cooling />
      <Psu look={gpu} />
      <Cables look={gpu} />
    </group>
  );
}

export default function Scene({ live, variant }: { live: React.MutableRefObject<Live>; variant: Variant }) {
  const still = typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      camera={{ fov: 24, near: 18, far: 700, position: TARGET.clone().add(HOME.clone().multiplyScalar(170)).toArray() }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onPointerMissed={() => live.current.pick(null)}
      frameloop={still ? "demand" : "always"}
    >
      <LiveContext.Provider value={live}>
        <hemisphereLight args={["#ffffff", "#c9ced6", 2.1]} />
        <directionalLight position={[60, 110, 80]} intensity={1.7} />
        <directionalLight position={[-80, 40, -40]} intensity={0.55} />
        <directionalLight position={[20, -30, 60]} intensity={0.35} />
        <Pc variant={variant} />
        <Ground />
        <Framing />
        <Preview />
        <Controls />
        <LiveDriver />
      </LiveContext.Provider>
    </Canvas>
  );
}
