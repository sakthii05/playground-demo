"use client";
// The 3D layer: a transparent canvas over the page's background, soft studio light, and the albums.
import { memo, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { easing } from "maath";
import { Album } from "./Album";
import { Intro, type IntroPhase } from "./Intro";
import { INK } from "./Scribble";
import { detailArt, frontBackdrop, queueUpload, upload } from "./textures";
import { wrap, type LiveRef } from "./live";
import type { Track } from "../data/tracks";

/** Eases the carousel after its target, and turns the studio a little with the pointer so
 *  highlights travel across the disc and its rainbow moves. Mount once. */
function Driver({ live }: { live: LiveRef }) {
  useFrame(({ scene }, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = live.current;
    // tight while being dragged or scrolled, so it sits under the finger; softer for steps and snaps
    easing.damp(s, "pos", s.target, performance.now() < s.steer ? 0.08 : 0.3, dt);
    easing.damp(scene.environmentRotation, "y", s.pointer.x * 0.5, 0.4, dt);
    easing.damp(scene.environmentRotation, "x", -s.pointer.y * 0.25, 0.4, dt);
  });
  return null;
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const upright = () => innerWidth / innerHeight < 0.9;
/** The albums either side of `i`, next first (it is the more likely). */
const neighbours = (tracks: Track[], i: number) => [tracks[wrap(i + 1, tracks.length)], tracks[wrap(i - 1, tracks.length)]];

/**
 * Keeps next and previous ready: once the centre album has settled, its two neighbours' detail art
 * is made (in idle time), sent to the GPU (a texture a frame), and their backdrop images encoded, so
 * stepping either way, browsing or at the front, never waits on any of it.
 */
function Prefetch({ tracks, active }: { tracks: Track[]; active: number }) {
  const gl = useThree((st) => st.gl);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      for (const t of neighbours(tracks, active)) {
        if (!alive) return;
        const art = await detailArt(t, upright());
        if (!(await upload(gl, art, () => alive))) return;
        await frontBackdrop(t);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [tracks, active, gl]);
  return null;
}

const TEXTURE_KEYS = ["map", "roughnessMap", "bumpMap", "normalMap", "alphaMap", "metalnessMap", "emissiveMap"] as const;

/**
 * The intro's warm-up: does every piece of first-time GPU work before the page is shown, so none of
 * it lands mid-scroll. It waits for every album's front cover and the first album's detail art, sends
 * every texture in the scene to the GPU (a few a frame), and compiles every shader, the disc's
 * included (it is mounted, out of sight, for the warm-up). Reports progress 0 … 1, then done.
 */
function Warmup({ live, tracks, first, onDone }: { live: LiveRef; tracks: Track[]; first: string; onDone: () => void }) {
  const count = tracks.length;
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let alive = true;
    const started = performance.now();
    // progress for the intro's ring: it only ever moves forward, and reaches 1 only at the very end
    const onProgress = (p: number) => {
      const i = live.current.intro;
      i.target = Math.max(i.target, Math.min(p, 0.99));
    };
    const until = async (ok: () => boolean, from: number, to: number, share: () => number, limit = 8000) => {
      while (alive && !ok() && performance.now() - started < limit) {
        onProgress(from + (to - from) * Math.min(1, share()));
        await frame();
      }
    };
    (async () => {
      const s = live.current;
      await until(() => s.fronts.size >= count, 0, 0.45, () => s.fronts.size / count);
      await until(() => s.detailReady === first, 0.45, 0.55, () => 0.5);
      // the first album's neighbours, and every album's backdrop image, ready before anyone asks
      const firstIndex = tracks.findIndex((t) => t.slug === first);
      for (const t of neighbours(tracks, firstIndex)) {
        if (!alive) return;
        await upload(gl, await detailArt(t, upright()), () => alive);
      }
      onProgress(0.6);
      for (const t of tracks) await frontBackdrop(t);
      // every texture any material in the scene uses, once each
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (!m) return;
        for (const mat of Array.isArray(m) ? m : [m]) for (const k of TEXTURE_KEYS) {
          const t = (mat as unknown as Record<string, THREE.Texture | null>)[k];
          if (t?.isTexture) textures.add(t);
        }
      });
      if (scene.environment) textures.add(scene.environment);
      let done = 0;
      for (const t of textures) {
        if (!alive) return;
        // through the shared queue: one a frame, so the intro's animation keeps its pace
        await queueUpload(gl, t);
        onProgress(0.6 + 0.3 * (++done / textures.size));
      }
      onProgress(0.92);
      // the scribble's ink only appears on hover, so it gets a stand-in mesh for the compile
      const ink = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), INK);
      ink.position.set(0, 0, -50);
      scene.add(ink);
      await gl.compileAsync(scene, camera);
      scene.remove(ink);
      ink.geometry.dispose();
      // a couple of real frames, so anything left is done behind the intro
      await frame();
      await frame();
      if (!alive) return;
      live.current.intro.target = 1;
      onDone();
    })();
    return () => {
      alive = false;
    };
  }, [gl, scene, camera, live, tracks, count, first, onDone]);
  return null;
}

/** Studio light as an environment map: a few soft panels and strips, no file to download. */
function Studio() {
  return (
    <Environment resolution={512} frames={1}>
      {/* not black: a polished disc reflects the whole room, and black reads as holes in it */}
      <color attach="background" args={["#1d1e21"]} />
      {/* a large dim panel behind the viewer, so what the disc mirrors back is a soft grey, not void */}
      <Lightformer form="rect" intensity={0.5} position={[0, 0, 12]} scale={[24, 14, 1]} />
      {/* key: a wide softbox above and in front */}
      <Lightformer form="rect" intensity={2.4} position={[0, 5, 6]} rotation-x={-Math.PI / 4} scale={[10, 3, 1]} />
      {/* thin strips either side: long, clean highlights on the rim and the data side */}
      <Lightformer form="rect" intensity={3} position={[-6, 0, 4]} rotation-y={Math.PI / 3} scale={[0.6, 10, 1]} />
      <Lightformer form="rect" intensity={2} position={[6, 1, 4]} rotation-y={-Math.PI / 3} scale={[0.6, 10, 1]} />
      {/* a warm and a cool fill so the iridescence has colour to work with */}
      <Lightformer form="rect" intensity={0.8} color="#ffd9b0" position={[-4, -4, 5]} scale={[5, 2, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#b9d4ff" position={[4, -3, 5]} scale={[5, 2, 1]} />
      {/* (no ring light: on the clear lid its dark middle mirrored as a round shadow) */}
    </Environment>
  );
}

interface Props {
  live: LiveRef;
  tracks: Track[];
  active: number;
  open: boolean;
  /** True until the intro's warm-up is done. */
  warm: boolean;
  onReady: () => void;
  /** The intro's steps, as it reaches them. */
  onPhase: (p: IntroPhase) => void;
}

function Scene({ live, tracks, active, open, warm, onReady, onPhase }: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0, 14] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        // keeps the cover colours close to what they are, unlike ACES
        gl.toneMapping = THREE.NeutralToneMapping;
      }}
    >
      <Studio />
      {/* soft fill only: a direct light puts a hard, blown-out spot on smooth plastic; the studio's
          panels do the shaping */}
      <hemisphereLight args={["#ffffff", "#3a3a40", 0.9]} />
      {tracks.map((t, i) => (
        <Album key={t.slug} track={t} index={i} count={tracks.length} selected={i === active} open={open} warm={warm} live={live} />
      ))}
      {warm ? <Warmup live={live} tracks={tracks} first={tracks[active].slug} onDone={onReady} /> : <Prefetch tracks={tracks} active={active} />}
      {/* the intro, and afterwards the logo in the top bar */}
      <Intro live={live} onPhase={onPhase} />
      <Driver live={live} />
    </Canvas>
  );
}

// the page re-renders for its own UI; the 3D tree only needs to when the selection changes
export default memo(Scene);
