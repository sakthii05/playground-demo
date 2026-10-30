"use client";
// One album: a clear jewel case placed in the carousel every frame from the live state. Inside it,
// the booklet clipped under the lid, the disc on the tray's hub, and the back insert under the tray
// with its spines folded up the sides. Only the album in the centre answers the pointer.
// At the front, the lid swings open on its hinge (and on tall screens the open case turns upright),
// and the closed case can be turned over to show its back.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { Disc } from "./Disc";
import { HINGE, caseGeometry } from "./geo";
import { BLANK, buildFront, detailArt, disposeArt, paperGrain, plasticWear, softShadow, queueUpload, upload, type DetailArt, type FrontArt } from "./textures";
import { CASE, DISC_REST, HOLD, LIFT, PAPER, R, S, Z, clamp01, discBusy, easeInOut, lerpTable, offsetOf, smooth, wrap, type LiveRef } from "./live";
import type { Track } from "../data/tracks";

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
/** Visual parts are never tested by the pointer; the plain hit boxes stand in for them. */
const NO_RAY = () => null;
const HIT = new THREE.MeshBasicMaterial({ visible: false });
/**
 * Hover tilt: how far the corner under the pointer presses back (radians, per axis), and how far the
 * case comes forward while it is hovered. The pointer is read off a flat area the size of the case
 * that does not tilt with it, so a strong tilt cannot pull the edge out from under the pointer (which
 * would end the hover, level the case, start the hover again, and flicker).
 */
const TILT = 0.4;
const TILT_POP = 0.07;
const HOVER_AREA = new THREE.PlaneGeometry(CASE.w, CASE.h);
const HOVER_HIT = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
/** How long an album must stay in the centre before its detail art is made (none while scrolling past). */
const SETTLE_MS = 450;
/** Open, the lid lies flat beside the base; this slides the pair so it stays centred. */
const SHIFT = (CASE.panel + CASE.hinge) / 2;
/** The open case's length (lid, hinge strip, base) and the closed case's width, in case heights. */
const SPAN = (2 * CASE.panel + CASE.hinge) / S;
const WIDE = CASE.w / S;

/** Where things go for a viewport of vw × vh world units (at the albums' depth). Worked out once per size. */
let laid: { vw: number; vh: number; L: ReturnType<typeof computeLayout> } | null = null;
export function layout(vw: number, vh: number) {
  if (!laid || laid.vw !== vw || laid.vh !== vh) laid = { vw, vh, L: computeLayout(vw, vh) };
  return laid.L;
}
function computeLayout(vw: number, vh: number) {
  const narrow = vw / vh < 0.9;
  // height of the centre case in world units, and the row either side, in centre-case heights
  const w = narrow ? Math.min(vh * 0.32, vw * 0.58) : Math.min(vh * 0.38, vw / 5.8);
  const xs = narrow ? [0, 0.98, 1.7, 2.2] : [0, 1.17, 2.05, 2.73, 3.25];
  const sc = narrow ? [1, 0.7, 0.52, 0.4] : [1, 0.72, 0.56, 0.44, 0.34];
  const show = narrow ? 2 : 3;
  // opened, the spread fits and leaves room for the player below: lying across on wide screens,
  // turned upright on tall ones
  const k = narrow ? Math.min((vw * 0.86) / w, (vh * 0.6) / (SPAN * w)) : Math.min((vw * 0.88) / (SPAN * w), (vh * 0.5) / w);
  return { narrow, w, xs, sc, show, k, y: narrow ? 0 : vh * -0.02, yOpen: narrow ? vh * 0.05 : vh * 0.06 };
}

/**
 * The front cover, for every album. The rest of the art for the chosen album: usually already made
 * and on the GPU (the warm-up and the neighbour prefetch see to that), otherwise made in small
 * pieces in idle time. While browsing it waits until the album has stayed in the centre a moment,
 * so scrolling past costs nothing; at the front it is wanted at once.
 */
function useArt(track: Track, chosen: boolean, now: boolean, live: LiveRef) {
  const gl = useThree((s) => s.gl);
  const upright = useThree((s) => s.size.width / s.size.height < 0.9);
  const [front, setFront] = useState<FrontArt | null>(null);
  const [detail, setDetail] = useState<DetailArt | null>(null);
  useEffect(() => {
    let alive = true;
    let made: FrontArt | null = null;
    buildFront(track).then(async (a) => {
      if (!alive) return disposeArt(a);
      made = a;
      // on the GPU first (through the shared queue), so showing it costs nothing
      await queueUpload(gl, a.front);
      if (!alive) return;
      setFront(a);
      live.current.fronts.add(track.slug);
    });
    return () => {
      alive = false;
      disposeArt(made);
    };
  }, [track, live, gl]);
  useEffect(() => {
    if (!chosen) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const art = await detailArt(track, upright);
      if (!(await upload(gl, art, () => alive))) return;
      setDetail(art);
      live.current.detailReady = track.slug;
    }, now ? 0 : SETTLE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [track, chosen, now, upright, gl, live]);
  // no longer chosen: let go of the art (it stays cached for a quick return; the cache frees it later)
  useEffect(() => {
    if (chosen) return;
    setDetail(null);
    if (live.current.detailReady === track.slug) live.current.detailReady = null;
  }, [chosen, track, live]);
  return { front, detail };
}

// ---------- materials ----------

/**
 * The clear plastic, without transmission (an extra render of the whole scene): its faces add only
 * their reflections, so the light streaks sweep over whatever is behind and the body stays clear,
 * with a breath of haze. Their cut edges, the rims, walls and hub are a cloudier grey, which is
 * what makes a jewel case read as one.
 */
let plastic: ReturnType<typeof makePlastic> | null = null;
function makePlastic() {
  return {
    edge: new THREE.MeshStandardMaterial({ color: "#dbe3e8", roughness: 0.18, metalness: 0, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.4 }),
    black: new THREE.MeshPhysicalMaterial({ color: "#0d0d0f", roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    paperEdge: new THREE.MeshStandardMaterial({ color: "#ece8df", roughness: 0.9 }),
  };
}
const shared = () => (plastic ??= makePlastic());

/**
 * One case's clear faces: they add only their reflections (kept soft and low, so they settle on the
 * case rather than glare), with a breath of haze, and the case's own few marks of wear.
 */
function useFaces(seed: number) {
  const face = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#000000",
        emissive: "#060708",
        roughness: 1,
        roughnessMap: plasticWear(seed),
        metalness: 0,
        envMapIntensity: 1.1,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [seed],
  );
  useEffect(
    () => () => {
      face.roughnessMap?.dispose();
      face.dispose();
    },
    [face],
  );
  return face;
}

/**
 * Paper: the booklet's front is coated stock with a soft gloss; the inside and the insert are
 * uncoated, with grain. Made once per album and kept: when art arrives (or goes) only their images
 * change, so the GPU never has to recompile their shaders mid-scroll. Until an image is there, a
 * blank one stands in, tinted with the album's colour.
 */
function usePaper(track: Track, front: FrontArt | null, detail: DetailArt | null) {
  const mats = useMemo(() => {
    const grain = paperGrain();
    const uncoated = (roughness = 0.74) => new THREE.MeshStandardMaterial({ map: BLANK, roughness, metalness: 0, bumpMap: grain, bumpScale: 0.45, envMapIntensity: 0.6 });
    const cover = new THREE.MeshPhysicalMaterial({ map: BLANK, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3, bumpMap: grain, bumpScale: 0.2, envMapIntensity: 0.8 });
    const inside = uncoated();
    const tray = uncoated();
    const back = uncoated(0.6);
    const spine = uncoated(0.6);
    return { cover, inside, tray, back, spine, all: [cover, inside, tray, back, spine] };
  }, []);
  useEffect(() => () => mats.all.forEach((m) => m.dispose()), [mats]);
  useLayoutEffect(() => {
    const base = new THREE.Color(track.color);
    const black = new THREE.Color("#000");
    const paint = (m: THREE.MeshStandardMaterial, map: THREE.Texture | undefined, darken: number) => {
      m.map = map ?? BLANK;
      m.color.copy(map ? new THREE.Color("#ffffff") : base.clone().lerp(black, darken));
    };
    paint(mats.cover, front?.front, 0);
    paint(mats.inside, detail?.inside, 0.12);
    paint(mats.tray, detail?.tray, 0.32);
    paint(mats.back, detail?.back, 0.22);
    paint(mats.spine, detail?.insert, 0.3);
  }, [mats, track.color, front, detail]);
  return mats;
}

interface AlbumProps {
  track: Track;
  index: number;
  count: number;
  selected: boolean;
  open: boolean;
  warm: boolean;
  live: LiveRef;
}

// memoised: when the centre album changes, only the two whose `selected` flips re-render
export const Album = memo(function Album({ track, index, count, selected, open, warm, live }: AlbumProps) {
  const place = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const upright = useRef<THREE.Group>(null);
  const spread = useRef<THREE.Group>(null);
  const caseRef = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const booklet = useRef<THREE.Mesh>(null);
  const corner = useMemo(() => new THREE.Vector3(), []);
  const recede = useRef({ v: 0, hold: 0 });
  const shadow = useRef<THREE.Mesh>(null);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: softShadow(), transparent: true, depthWrite: false, opacity: 0 }), []);
  useEffect(() => () => shadowMat.dispose(), [shadowMat]);

  const { front, detail } = useArt(track, selected, open, live);
  // while the intro warms up, the chosen album also carries its disc and shadow, so their shaders compile then
  const withDisc = selected && (open || warm);
  const paper = usePaper(track, front, detail);
  const geo = caseGeometry();
  const p = shared();
  const faces = useFaces(track.rank);
  const plate = useMemo(() => [p.edge, p.edge, p.edge, p.edge, faces, faces], [p, faces]);
  const trayMat = track.tray === "black" ? p.black : plate;
  // box faces: +x, −x, +y, −y, +z, −z
  const bookMats = useMemo(() => [p.paperEdge, p.paperEdge, p.paperEdge, p.paperEdge, paper.cover, paper.inside], [p, paper]);
  const inlayMats = useMemo(() => [p.paperEdge, p.paperEdge, p.paperEdge, p.paperEdge, paper.tray, paper.back], [p, paper]);

  const chosen = () => index === wrap(Math.round(live.current.target), count);
  const isCentre = () => chosen() && Math.abs(offsetOf(index, live.current.pos, count)) < 0.35;
  /** At the front with the lid shut (either way up): hover tilts it, a click opens it or turns it back. */
  const frontShut = () => {
    const s = live.current;
    return s.mode === "open" && s.caseState === "closed" && s.swap.from < 0 && chosen();
  };
  const isLid = (o: THREE.Object3D) => {
    for (let n: THREE.Object3D | null = o; n; n = n.parent) if (n === lid.current) return true;
    return false;
  };

  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = live.current;
    const g = place.current;
    if (!g || !tilt.current || !upright.current || !spread.current || !caseRef.current || !lid.current) return;
    const { width: vw, height: vh } = state.viewport;
    const { camera, size } = state;
    const L = layout(vw, vh);
    const sel = chosen();
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
        const travel = vw * 0.5 + L.w * L.k * WIDE * 0.8;
        const k = leaving ? -t : 1 - t;
        x += s.swap.dir * k * travel;
        rotY = -s.swap.dir * k * 0.6;
        z -= Math.abs(k) * L.w * 0.8;
      } else {
        // turned over: half a turn about the upright, lifting toward you on the way round
        const f = s.anim.flip;
        rotY += Math.PI * f;
        z += Math.sin(f * Math.PI) * L.w * 0.35;
      }
    } else {
      // the rest leave by the nearer edge, the inner ones a beat after the outer ones
      const f = smooth(clamp01(s.anim.fly * 1.5 - (L.show - Math.min(a, L.show)) * 0.16));
      const out = side === 0 ? 1 : side;
      x += out * f * vw * 0.85;
      rotY -= out * f * 0.7;
      z -= f * L.w;
    }

    // during the warm-up every album is "visible", so its shaders compile and textures upload before you see it
    g.visible = warm || scale > 0.001;
    g.position.set(x, y, z);
    g.rotation.set(rotX, rotY, 0);
    g.scale.setScalar((scale * L.w) / S);

    // hover tilt: the corner under the pointer presses back
    const h = s.hover.on && ((s.mode === "browse" && isCentre()) || frontShut()) ? s.hover : null;
    easing.dampE(tilt.current.rotation, [h ? -h.y * TILT : 0, h ? h.x * TILT : 0, 0], 0.2, dt);
    easing.damp(tilt.current.position, "z", h ? TILT_POP : 0, 0.2, dt);

    // the lid swings over on its hinge to lie flat; the pair slides to stay centred, and on tall
    // screens turns upright as it opens so the lid ends up above the base
    const open = sel && !leaving ? s.anim.hinge : 0;
    lid.current.rotation.y = -Math.PI * open;
    spread.current.position.x = (CASE.hinge / 2) * (1 - open) + SHIFT * open;
    upright.current.rotation.z = L.narrow ? (-Math.PI / 2) * open : 0;

    // the open lid's page: bare paper while the lyrics are on, and its place on screen for them
    if (selected) {
      if (detail) {
        const want = s.lyrics ? detail.blank : detail.inside;
        if (paper.inside.map !== want) paper.inside.map = want;
      }
      const page = s.page;
      page.on = s.mode === "open" && s.caseState === "open" && s.swap.from < 0 && !!booklet.current;
      if (page.on && booklet.current) {
        booklet.current.updateWorldMatrix(true, false);
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const [cx, cy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          corner.set(PAPER.bookX + (cx * PAPER.bookW) / 2, (cy * PAPER.bookH) / 2, Z.book).applyMatrix4(booklet.current.matrixWorld).project(camera);
          const px = (corner.x * 0.5 + 0.5) * size.width;
          const py = (0.5 - corner.y * 0.5) * size.height;
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          y0 = Math.min(y0, py);
          y1 = Math.max(y1, py);
        }
        page.x = x0;
        page.y = y0;
        page.w = x1 - x0;
        page.h = y1 - y0;
      }
    }

    // While the disc is being turned the case backs away, far enough for a full flip, and stays
    // there until the disc has settled for a moment; then it comes back in once.
    const d = s.disc;
    const above = DISC_REST - Z.well + (sel ? s.anim.lift * LIFT : 0);
    const lean = Math.max(Math.abs(Math.sin(d.yaw)), Math.abs(Math.sin(d.pitch)));
    const need = sel ? Math.max(0, R * lean + 0.03 - above) : 0;
    const r = recede.current;
    if (s.caseState === "closing") r.hold = 0;
    else if (sel && s.caseState !== "closed" && discBusy(d)) r.hold = HOLD;
    else r.hold = Math.max(0, r.hold - dt);
    easing.damp(r, "v", r.hold > 0 ? R + 0.04 - above : 0, 0.22, dt);
    r.v = Math.max(r.v, need);
    caseRef.current.position.z = -r.v;
    if (sel) d.back = r.v;

    // the disc's shadow on the tray: tight while it rests, softer and wider as it lifts away
    if (shadow.current) {
      const gap = Math.max(0, d.z - DISC_REST) + r.v;
      const spreadK = 1 + gap * 0.9;
      shadow.current.scale.set(R * 2.08 * spreadK, R * 2.08 * spreadK * (1 - 0.25 * lean), 1);
      shadow.current.position.set(gap * 0.12, -gap * 0.32, Z.well + 0.002);
      shadowMat.opacity = sel ? 0.5 / (1 + gap * 2.2) : 0;
    }
  });

  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!place.current || !((live.current.mode === "browse" && isCentre()) || frontShut())) return;
    e.stopPropagation();
    const q = place.current.worldToLocal(e.point.clone());
    live.current.hover = { on: true, x: THREE.MathUtils.clamp(q.x / (CASE.w / 2), -1, 1), y: THREE.MathUtils.clamp(q.y / (S / 2), -1, 1) };
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    if (!live.current.hover.on) return;
    live.current.hover.on = false;
    if (!live.current.disc.hover) document.body.style.cursor = "";
  };
  const openLid = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const s = live.current;
    return s.mode === "open" && s.caseState === "open" && selected && isLid(e.object);
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    // the open lid closes again
    if (!openLid(e)) return;
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    const s = live.current;
    if (e.delta > 6) return;
    const reset = () => {
      e.stopPropagation();
      s.hover.on = false;
      document.body.style.cursor = "";
    };
    if (s.mode === "browse" && isCentre()) {
      reset();
      s.open();
    } else if (frontShut()) {
      reset();
      if (s.anim.flip > 0.5) s.turnOver();
      else s.toggleCase();
    } else if (openLid(e)) {
      reset();
      s.toggleCase();
    }
  };

  return (
    <group ref={place}>
      {/* the hover area: the case's footprint, half way through it, level whatever the tilt */}
      <mesh geometry={HOVER_AREA} material={HOVER_HIT} position={[0, 0, (Z.top + Z.back) / 2]} onPointerMove={move} onPointerOut={out} onClick={click} />
      <group ref={tilt} onPointerOver={over} onClick={click}>
        <group ref={upright}>
          <group ref={spread}>
            <group ref={caseRef}>
              {/* base: back plate, the insert lying on it with its spines up the sides, the tray over it */}
              <mesh geometry={geo.backPlate} material={plate} raycast={NO_RAY} />
              <mesh geometry={geo.inlay} material={inlayMats} raycast={NO_RAY} />
              <mesh geometry={geo.spineL} material={paper.spine} raycast={NO_RAY} />
              <mesh geometry={geo.spineR} material={paper.spine} raycast={NO_RAY} />
              <mesh geometry={geo.trayPlate} material={trayMat} raycast={NO_RAY} />
              <mesh geometry={geo.baseFrame} material={p.edge} raycast={NO_RAY} />
              <mesh geometry={geo.hitBase} material={HIT} />
              {withDisc && <mesh ref={shadow} material={shadowMat} geometry={UNIT_PLANE} raycast={NO_RAY} />}
              {/* lid: turns about the hinge axis, with the booklet clipped under it */}
              <group position={[HINGE.x, 0, HINGE.z]}>
                <group ref={lid}>
                  <group position={[-HINGE.x, 0, -HINGE.z]}>
                    <mesh ref={booklet} geometry={geo.booklet} material={bookMats} raycast={NO_RAY} />
                    <mesh geometry={geo.lidPlate} material={plate} raycast={NO_RAY} />
                    <mesh geometry={geo.lidFrame} material={p.edge} raycast={NO_RAY} />
                    <mesh geometry={geo.hitLid} material={HIT} />
                  </group>
                </group>
              </group>
            </group>
            {/* only the chosen album's disc is ever seen, and only once it is at the front */}
            {withDisc && <Disc color={track.color} label={detail?.label ?? null} live={live} active />}
          </group>
        </group>
      </group>
    </group>
  );
});
