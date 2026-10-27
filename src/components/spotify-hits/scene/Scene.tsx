"use client";
// The 3D layer: a transparent canvas over the page's background, soft studio light, and the albums.
import { memo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { easing } from "maath";
import { Album } from "./Album";
import type { LiveRef } from "./live";
import type { Track } from "../data/tracks";

/** Eases the carousel after its target, and turns the studio a little with the pointer so
 *  highlights travel across the disc and its rainbow moves. Mount once. */
function Driver({ live }: { live: LiveRef }) {
  useFrame(({ scene }, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = live.current;
    easing.damp(s, "pos", s.target, 0.32, dt);
    easing.damp(scene.environmentRotation, "y", s.pointer.x * 0.5, 0.4, dt);
    easing.damp(scene.environmentRotation, "x", -s.pointer.y * 0.25, 0.4, dt);
  });
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
      <Lightformer form="ring" intensity={1.4} position={[0, 0, 9]} scale={3} />
    </Environment>
  );
}

function Scene({ live, tracks, active }: { live: LiveRef; tracks: Track[]; active: number }) {
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
      <ambientLight intensity={0.2} />
      <directionalLight position={[2, 4, 8]} intensity={1.1} />
      {tracks.map((t, i) => (
        <Album key={t.slug} track={t} index={i} count={tracks.length} selected={i === active} live={live} />
      ))}
      <Driver live={live} />
    </Canvas>
  );
}

// the page re-renders for its own UI; the 3D tree only needs to when the selection changes
export default memo(Scene);
