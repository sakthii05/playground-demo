"use client";
// The CD, built like the real one: the cover printed on the label in satin ink with its dot screen
// catching the light, a bright band, the clear hub with its stacking ring and the hole's cut edge,
// a silver rim, and the data side underneath: dark, with fine tracks and a rainbow shine.
// On the open album it pops on hover and can be dragged round and flipped, then settles face up or down.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { Scribble } from "./Scribble";
import { BLANK, dataSide, printScreen } from "./textures";
import { DISC, DISC_REST, H, LIFT, POP, R, type LiveRef } from "./live";

const SEG = 128;
/** Spin while playing, in radians a second: about 6 turns a minute, slow enough to read the label. */
const SPIN = 0.65;

// shared by every disc, made on first use (they need the generated maps)
let shared: ReturnType<typeof makeShared> | null = null;
function makeShared() {
  return {
    // satin ink on metal: a broad sheen, with the dot screen only showing where the light is
    print: new THREE.MeshPhysicalMaterial({
      map: BLANK,
      metalness: 0.25,
      roughness: 0.5,
      roughnessMap: printScreen(),
      clearcoat: 0.35,
      clearcoatRoughness: 0.45,
      sheen: 0.4,
      sheenRoughness: 0.6,
    }),
    silver: new THREE.MeshPhysicalMaterial({ color: "#e4e7ea", metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    band: new THREE.MeshPhysicalMaterial({ color: "#c9ced4", metalness: 0.9, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
    hub: new THREE.MeshPhysicalMaterial({ color: "#dfe4e8", metalness: 0, roughness: 0.12, transparent: true, opacity: 0.42, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    stack: new THREE.MeshPhysicalMaterial({ color: "#aeb4bb", metalness: 0.2, roughness: 0.35, transparent: true, opacity: 0.85, clearcoat: 1 }),
    holeEdge: new THREE.MeshStandardMaterial({ color: "#7d838a", metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }),
    // polished but not a perfect mirror: a mirror shows every edge of the studio lights as hard
    // blocks; a little roughness turns them into the broad, soft sweeps a real disc has
    data: new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      map: dataSide(),
      metalness: 0.85,
      roughness: 0.3,
      iridescence: 1,
      iridescenceIOR: 1.6,
      iridescenceThicknessRange: [250, 800],
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
    }),
  };
}

export function Disc({ color, label, live, active }: { color: string; label: THREE.Texture | null; live: LiveRef; active: boolean }) {
  const lift = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const pop = useRef({ v: 0 });
  const spinSpeed = useRef({ v: 0 });
  const last = useRef({ x: 0, y: 0, t: 0 });
  const m = useMemo(() => (shared ??= makeShared()), []);

  // one disc is ever on screen, so its print is shared and kept: only the label changes
  const print = m.print;
  useLayoutEffect(() => {
    print.map = label ?? BLANK;
    print.color.set(label ? "#ffffff" : color);
  }, [print, label, color]);

  const isOn = () => active && live.current.mode === "open" && live.current.caseState === "open";

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = live.current;
    const d = s.disc;
    if (!lift.current || !turn.current || !spin.current) return;
    const on = isOn();
    easing.damp(pop.current, "v", on && (d.hover || d.drag) ? 1 : 0, 0.14, dt);
    // rests in the tray; the open timeline lifts it clear, hover lifts it a little more
    lift.current.position.z = DISC_REST + (active ? s.anim.lift * LIFT : 0) + pop.current.v * POP;
    d.z = lift.current.position.z;
    if (!active) {
      turn.current.rotation.set(0, 0, 0);
      return;
    }
    if (!d.drag) {
      // coast after a flick, then settle on the nearest face
      d.yaw += d.vYaw * dt;
      d.vYaw *= Math.exp(-dt * 2.6);
      if (Math.abs(d.vYaw) < 0.6 || !on) {
        d.vYaw = 0;
        // open, either face will do; going back in the tray, it turns label-up
        const face = on ? Math.PI : Math.PI * 2;
        easing.damp(d, "yaw", Math.round(d.yaw / face) * face, on ? 0.3 : 0.15, dt);
      }
      easing.damp(d, "pitch", 0, 0.3, dt);
    }
    turn.current.rotation.set(d.pitch, d.yaw, 0);
    // turns slowly while the song plays; eases to a stop while the pointer is on it
    easing.damp(spinSpeed.current, "v", s.playing && !d.hover && !d.drag ? SPIN : 0, 0.45, dt);
    d.spin += spinSpeed.current.v * dt;
    spin.current.rotation.z = -d.spin;
  });

  const down = (e: ThreeEvent<PointerEvent>) => {
    if (!isOn()) return;
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    live.current.disc.drag = true;
    live.current.disc.vYaw = 0;
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    document.body.style.cursor = "grabbing";
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const d = live.current.disc;
    if (!isOn() || !d.drag) return;
    e.stopPropagation();
    const now = performance.now();
    const dx = (e.clientX - last.current.x) * 0.012;
    const dy = (e.clientY - last.current.y) * 0.012;
    const dt = Math.max(0.008, (now - last.current.t) / 1000);
    d.yaw += dx;
    d.pitch = THREE.MathUtils.clamp(d.pitch + dy, -0.7, 0.7);
    d.vYaw = THREE.MathUtils.clamp(dx / dt, -14, 14);
    last.current = { x: e.clientX, y: e.clientY, t: now };
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    const d = live.current.disc;
    if (!d.drag) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    d.drag = false;
    // a pause before letting go means no flick
    if (performance.now() - last.current.t > 80) d.vYaw = 0;
    document.body.style.cursor = d.hover ? "grab" : "";
  };

  return (
    <group ref={lift}>
      {active && <Scribble on={() => isOn() && (live.current.disc.hover || live.current.disc.drag)} />}
      <group
        ref={turn}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClick={(e) => isOn() && e.stopPropagation()}
        onPointerOver={(e) => {
          if (!isOn()) return;
          e.stopPropagation();
          live.current.disc.hover = true;
          if (!live.current.disc.drag) document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          live.current.disc.hover = false;
          if (!live.current.disc.drag) document.body.style.cursor = "";
        }}
      >
        <group ref={spin}>
          {/* print side */}
          <mesh material={print} position={[0, 0, H / 2]}>
            <ringGeometry args={[R * DISC.mirror, R * DISC.print, SEG, 1]} />
          </mesh>
          <mesh material={m.band} position={[0, 0, H / 2]}>
            <ringGeometry args={[R * DISC.hub, R * DISC.mirror, SEG]} />
          </mesh>
          <mesh material={m.silver} position={[0, 0, H / 2]}>
            <ringGeometry args={[R * DISC.print, R, SEG]} />
          </mesh>
          {/* clear hub, seen from both sides, with the stacking ring and the cut edge of the hole */}
          <mesh material={m.hub}>
            <ringGeometry args={[R * DISC.hole, R * DISC.hub, SEG]} />
          </mesh>
          <mesh material={m.stack} position={[0, 0, H * 0.2]}>
            <torusGeometry args={[R * DISC.stack, H * 0.4, 8, SEG]} />
          </mesh>
          <mesh material={m.holeEdge} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[R * DISC.hole, R * DISC.hole, H, 48, 1, true]} />
          </mesh>
          {/* rim */}
          <mesh material={m.silver} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[R, R, H, SEG, 1, true]} />
          </mesh>
          {/* data side */}
          <mesh material={m.data} position={[0, 0, -H / 2]} rotation={[0, Math.PI, 0]}>
            <ringGeometry args={[R * DISC.hub, R, SEG]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
