"use client";
// One album: a card digipak (tray panel with the disc, a spine, and the front cover) placed in the
// carousel every frame from the live state. Only the album in the centre answers the pointer.
// Open, the spine folds flat and the cover swings over (left on wide screens, up on tall ones).
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { Disc } from "./Disc";
import { panelGeometry } from "./geo";
import { buildArt, disposeArt, paperGrain, softShadow, type Art } from "./textures";
import { CORNER, H, LIFT, R, S, SPINE, T, clamp01, discBusy, easeInOut, lerpTable, offsetOf, smooth, wrap, type LiveRef } from "./live";
import type { Track } from "../data/tracks";

const BLACK = new THREE.Color("#000000");
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
/** How far the spread slides to stay centred once open: half the cover, spine and both boards. */
const SHIFT = (S + SPINE + 2 * T) / 2;

/** Where things go for a viewport of vw × vh world units (at the albums' depth). */
export function layout(vw: number, vh: number) {
  const narrow = vw / vh < 0.9;
  // width of the centre album in world units, and the row either side, in centre-album widths
  const w = narrow ? Math.min(vh * 0.34, vw * 0.64) : Math.min(vh * 0.38, vw / 5.2);
  const xs = narrow ? [0, 0.9, 1.55, 2.0] : [0, 1.06, 1.86, 2.48, 2.95];
  const sc = narrow ? [1, 0.7, 0.52, 0.4] : [1, 0.72, 0.56, 0.44, 0.34];
  const show = narrow ? 2 : 3;
  // opened, the spread fits and leaves room for the player below: side by side on wide screens,
  // one above the other on tall ones
  const span = (2 * S + SPINE + 2 * T) / S;
  const k = narrow ? Math.min((vw * 0.86) / w, (vh * 0.6) / (span * w)) : Math.min((vw * 0.86) / (span * w), (vh * 0.5) / w);
  return { narrow, w, xs, sc, show, k, y: narrow ? 0 : vh * -0.02, yOpen: narrow ? vh * 0.05 : vh * 0.06 };
}

function useArt(track: Track) {
  const [art, setArt] = useState<Art | null>(null);
  useEffect(() => {
    let alive = true;
    let made: Art | null = null;
    buildArt(track).then((a) => {
      if (alive) setArt((made = a));
      else disposeArt(a);
    });
    return () => {
      alive = false;
      disposeArt(made);
    };
  }, [track]);
  return art;
}

/** Card stock: matte, with a paper grain in the light, and the print on top. */
function useCaseMaterials(color: string, art: Art | null) {
  const mats = useMemo(() => {
    const base = new THREE.Color(color);
    const grain = paperGrain();
    const card = (map: THREE.Texture | undefined, fallback: THREE.Color, roughness = 0.78) =>
      new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : fallback, map, roughness, metalness: 0, bumpMap: grain, bumpScale: 0.35, envMapIntensity: 0.55 });
    const front = card(art?.front, base, 0.62); // a light satin laminate on the front
    const inside = card(art?.inside, base.clone().lerp(BLACK, 0.3));
    const tray = card(art?.tray, base.clone().lerp(BLACK, 0.6));
    const back = card(art?.back, base.clone().lerp(BLACK, 0.35));
    const edge = card(undefined, base.clone().lerp(BLACK, 0.2), 0.9);
    const spine = card(undefined, base.clone().lerp(BLACK, 0.1), 0.8);
    // panel groups: −z face, +z face, cut edge
    return { cover: [inside, front, edge], base: [back, tray, edge], spine, all: [front, inside, tray, back, edge, spine] };
  }, [color, art]);
  useEffect(() => () => mats.all.forEach((m) => m.dispose()), [mats]);
  return mats;
}

// the hub the disc clips onto (the recess round it is printed into the tray art)
const hubPlastic = new THREE.MeshStandardMaterial({ color: "#8d9298", roughness: 0.45 });

export function Album({ track, index, count, selected, live }: { track: Track; index: number; count: number; selected: boolean; live: LiveRef }) {
  const place = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const spread = useRef<THREE.Group>(null);
  const caseRef = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const spineMesh = useRef<THREE.Mesh>(null);
  const hinge = useRef<THREE.Group>(null);
  const cover = useRef<THREE.Mesh>(null);
  const recede = useRef({ v: 0 });
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0 }), []);
  useEffect(() => () => shadowMat.dispose(), [shadowMat]);
  const art = useArt(track);
  const mats = useCaseMaterials(track.color, art);
  const panel = panelGeometry(S, T, CORNER);

  const isCentre = () => {
    const s = live.current;
    return index === wrap(Math.round(s.target), count) && Math.abs(offsetOf(index, s.pos, count)) < 0.35;
  };
  /** At the front with its cover shut: hover tilts it, a click opens it. */
  const frontShut = () => {
    const s = live.current;
    return s.mode === "open" && s.caseState === "closed" && s.swap.from < 0 && index === wrap(Math.round(s.target), count);
  };

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = live.current;
    const g = place.current;
    if (!g || !tilt.current || !spread.current || !caseRef.current || !spine.current || !spineMesh.current || !hinge.current || !cover.current) return;
    const { width: vw, height: vh } = state.viewport;
    const L = layout(vw, vh);
    const sel = index === wrap(Math.round(s.target), count);
    const leaving = s.swap.from === index;

    const o = offsetOf(index, s.pos, count);
    const a = Math.abs(o);
    const side = Math.sign(o);
    const fade = a > L.show ? clamp01(1 - (a - L.show) / 0.7) : 1;
    let x = side * lerpTable(L.xs, a) * L.w;
    let y = L.y;
    let z = -Math.min(a, 3) * 0.22 * L.w;
    let scale = lerpTable(L.sc, a) * fade;
    let rotY = -side * Math.min(a, 1) * 0.26;
    let rotX = 0;

    if (sel || leaving) {
      // the chosen album rises to the middle, grows to fit the open spread, and swings a little on the way
      const r = leaving ? 1 : s.anim.rise;
      if (leaving) scale = 1;
      x *= 1 - r;
      y += (L.yOpen - y) * r;
      z *= 1 - r;
      scale += (L.k - scale) * r;
      rotY *= 1 - r;
      rotX = Math.sin(r * Math.PI) * 0.2;
      if (s.swap.from >= 0) {
        // next / previous: the old one slides out one side as the new one slides in from the other
        const t = easeInOut(s.swap.t);
        const travel = vw * 0.5 + L.w * L.k * 0.8;
        const k = leaving ? -t : 1 - t;
        x += s.swap.dir * k * travel;
        rotY = -s.swap.dir * k * 0.6;
        z -= Math.abs(k) * L.w * 0.8;
      }
    } else {
      // the rest leave by the nearer edge, the inner ones a beat after the outer ones
      const f = smooth(clamp01(s.anim.fly * 1.5 - (L.show - Math.min(a, L.show)) * 0.16));
      const out = side === 0 ? 1 : side;
      x += out * f * vw * 0.85;
      rotY -= out * f * 0.7;
      z -= f * L.w;
    }

    g.visible = scale > 0.001;
    g.position.set(x, y, z);
    g.rotation.set(rotX, rotY, 0);
    g.scale.setScalar((scale * L.w) / S);

    // hover tilt: the corner under the pointer presses back
    const h = s.hover.on && ((s.mode === "browse" && isCentre()) || frontShut()) ? s.hover : null;
    easing.dampE(tilt.current.rotation, [h ? -h.y * 0.2 : 0, h ? h.x * 0.2 : 0, 0], 0.18, dt);

    // the spine folds flat and the cover turns over it: half a turn each, a full turn for the cover
    const open = sel && !leaving ? s.anim.hinge : 0;
    const half = (-Math.PI / 2) * open;
    if (L.narrow) {
      spine.current.position.set(0, S / 2 + T, -T);
      spine.current.rotation.set(half, 0, 0);
      spineMesh.current.scale.set(S, T, SPINE);
      spineMesh.current.position.set(0, -T / 2, SPINE / 2);
      hinge.current.rotation.set(half, 0, 0);
      cover.current.position.set(0, -(T + S / 2), -T / 2);
      spread.current.position.set(0, -SHIFT * open, 0);
    } else {
      spine.current.position.set(-S / 2 - T, 0, -T);
      spine.current.rotation.set(0, half, 0);
      spineMesh.current.scale.set(T, S, SPINE);
      spineMesh.current.position.set(T / 2, 0, SPINE / 2);
      hinge.current.rotation.set(0, half, 0);
      cover.current.position.set(T + S / 2, 0, -T / 2);
      spread.current.position.set(SHIFT * open, 0, 0);
    }
    // the inside of the cover is seen upside down when it opens upwards
    if (art) {
      const turn = L.narrow ? Math.PI : 0;
      if (art.inside.rotation !== turn) {
        art.inside.center.set(0.5, 0.5);
        art.inside.rotation = turn;
      }
    }

    // while the disc is turned, the sleeve backs away so the disc never cuts into it
    const d = s.disc;
    const discZ = H / 2 + 0.006 + (sel ? s.anim.lift * LIFT : 0);
    const lean = Math.max(Math.abs(Math.sin(d.yaw)), Math.abs(Math.sin(d.pitch)));
    const need = sel ? Math.max(0, R * lean + 0.03 - discZ) : 0;
    const want = sel && s.caseState !== "closed" && discBusy(d) ? Math.max(need, R * 0.7 - discZ) : 0;
    easing.damp(recede.current, "v", want, 0.16, dt);
    recede.current.v = Math.max(recede.current.v, need);
    caseRef.current.position.z = -recede.current.v;

    // the disc's shadow on the tray: tight and dark while it rests, softer, wider and dropping away
    // from the key light (above, in front) as it lifts and the sleeve backs off
    if (shadow.current) {
      const gap = Math.max(0, d.z - H / 2) + recede.current.v;
      const spread = 1 + gap * 0.9;
      shadow.current.scale.set(R * 2.08 * spread, R * 2.08 * spread * (1 - 0.25 * lean), 1);
      shadow.current.position.set(gap * 0.12, -gap * 0.32, 0.002);
      shadowMat.opacity = sel ? 0.55 / (1 + gap * 2.2) : 0;
    }
  });

  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!tilt.current || !((live.current.mode === "browse" && isCentre()) || frontShut())) return;
    e.stopPropagation();
    const p = tilt.current.worldToLocal(e.point.clone());
    live.current.hover = { on: true, x: THREE.MathUtils.clamp(p.x / (S / 2), -1, 1), y: THREE.MathUtils.clamp(p.y / (S / 2), -1, 1) };
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (!live.current.hover.on) return;
    live.current.hover.on = false;
    if (!live.current.disc.hover) document.body.style.cursor = "";
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    const s = live.current;
    // the open cover's inside panel closes it again
    if (s.mode === "open" && s.caseState === "open" && selected && e.object === cover.current) {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    }
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    const s = live.current;
    if (e.delta > 6) return;
    if (s.mode === "browse" && isCentre()) {
      e.stopPropagation();
      s.hover.on = false;
      document.body.style.cursor = "";
      s.open();
    } else if (frontShut() || (s.mode === "open" && s.caseState === "open" && selected && e.object === cover.current)) {
      e.stopPropagation();
      s.hover.on = false;
      document.body.style.cursor = "";
      s.toggleCase();
    }
  };

  return (
    <group ref={place}>
      <group ref={tilt} onPointerMove={move} onPointerOut={out} onPointerOver={over} onClick={click}>
        <group ref={spread}>
          <group ref={caseRef}>
            {/* tray panel, its inner face at z = 0 */}
            <mesh geometry={panel} material={mats.base} position={[0, 0, -T / 2]} />
            <mesh material={hubPlastic} position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[R * 0.11, R * 0.12, 0.012, 32]} />
            </mesh>
            {selected && <mesh ref={shadow} material={shadowMat} position={[0, 0, 0.002]} geometry={UNIT_PLANE} raycast={() => null} />}
            {/* spine, then the cover hinged on its far edge (both placed each frame) */}
            <group ref={spine}>
              <mesh ref={spineMesh} material={mats.spine}>
                <boxGeometry args={[1, 1, 1]} />
              </mesh>
              <group ref={hinge} position={[0, 0, SPINE]}>
                <mesh ref={cover} geometry={panel} material={mats.cover} />
              </group>
            </group>
          </group>
          {/* only the selected album's disc is ever seen (the others stay shut in their sleeves) */}
          {selected && <Disc color={track.color} label={art?.label ?? null} live={live} active />}
        </group>
      </group>
    </group>
  );
}
