"use client";
// The intro, drawn in the same canvas as the albums and in front of them:
//   1. a black screen, with faint flecks of light drifting over it as a mirror ball throws on a wall;
//   2. the disco-ball logo scales up in the middle, its tiles flashing as they turn to the light;
//   3. a thin green ring round it fills with the real loading progress (it can only reach the end
//      once everything is loaded and warmed up), then flows away, its tail chasing its head;
//   4. the ball turns once and flies to the logo slot in the top bar (and keeps turning there);
//   5. then the black screen crumbles away in fine grain, outwards from the ball, showing the albums.
// Everything here is a few draw calls: the ball is one instanced mesh, the ring one ribbon, the
// black screen one shader. All the motion is GPU work driven by a GSAP timeline.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import gsap from "gsap";
import type { LiveRef } from "./live";

/** How far in front of the albums the intro draws: the black screen, then the ball and ring. */
const Z_CURTAIN = 5;
const Z_BALL = 6;
const NO_RAY = () => null;

/** "drawn": the 3D black screen is on screen (the page's own black cover can go). */
export type IntroPhase = "drawn" | "loading" | "revealing" | "done";

// ---------- the ball ----------

/**
 * The three bars, as seen on the ball's face (unit radius), measured off the reference: each a bowed
 * stroke with round ends, the top one longest, the whole mark leaning up to the right a touch.
 */
const BARS = [
  { y: 0.27, half: 0.56, t: 0.19, bend: 0.38 },
  { y: -0.02, half: 0.49, t: 0.17, bend: 0.36 },
  { y: -0.3, half: 0.41, t: 0.15, bend: 0.34 },
];
const TILT = 0.06;

/**
 * The tiles: rings of mirror squares round the sphere, as big as the reference's (about twenty rows
 * top to bottom), each squared to the lines of latitude and longitude and tilted a hair at random, as
 * real ones are glued on. Each gets a shade and a random number of its own, so no two catch the light
 * quite alike. The bars lie over the tiles (see buildBars), so every tile stays and the bars' edges
 * are exactly their own smooth outline.
 */
function buildTiles() {
  const TILE = 0.135;
  const GAP = 0.018;
  const rings = Math.round(Math.PI / TILE);
  const mats: THREE.Matrix4[] = [];
  const shades: number[] = [];
  const seeds: number[] = [];
  const q = new THREE.Quaternion();
  const jitter = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  const east = new THREE.Vector3();
  const north = new THREE.Vector3();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < rings; i++) {
    const lat = -Math.PI / 2 + ((i + 0.5) * Math.PI) / rings;
    const count = Math.max(4, Math.round((2 * Math.PI * Math.cos(lat)) / TILE));
    const offset = rnd() * Math.PI * 2;
    const w = (2 * Math.PI * Math.cos(lat)) / count - GAP;
    const h = Math.PI / rings - GAP;
    for (let j = 0; j < count; j++) {
      const lon = offset + ((j + 0.5) / count) * Math.PI * 2;
      n.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      east.crossVectors(up, n).normalize();
      north.crossVectors(n, east);
      basis.makeBasis(east, north, n);
      q.setFromRotationMatrix(basis);
      jitter.setFromEuler(e.set((rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.06));
      q.multiply(jitter);
      mats.push(new THREE.Matrix4().compose(n.clone(), q.clone(), new THREE.Vector3(Math.max(0.02, w), Math.max(0.02, h), 0.03)));
      shades.push(0.62 + rnd() * 0.55);
      seeds.push(rnd());
    }
  }
  return { mats, shades, seeds };
}

/**
 * The bars as smooth matte-black shapes lying on the ball, front and back (the back mirrored so the
 * mark reads from behind too), drawn from the same outline as the tile cut-out so the tiles stop
 * cleanly at their edges, as on the reference.
 */
function buildBars() {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  const shapes = BARS.map((b) => {
    const pts: THREE.Vector2[] = [];
    const N = 48;
    const curve = (x: number) => b.y - b.bend * x * x;
    // top edge left to right, the right cap, the bottom edge back, the left cap
    for (let k = 0; k <= N; k++) {
      const x = -b.half + (2 * b.half * k) / N;
      pts.push(new THREE.Vector2(x, curve(x) + b.t / 2));
    }
    for (let k = 1; k < 16; k++) {
      const a = Math.PI / 2 - (k / 16) * Math.PI;
      pts.push(new THREE.Vector2(b.half + Math.cos(a) * (b.t / 2), curve(b.half) + Math.sin(a) * (b.t / 2)));
    }
    for (let k = 0; k <= N; k++) {
      const x = b.half - (2 * b.half * k) / N;
      pts.push(new THREE.Vector2(x, curve(x) - b.t / 2));
    }
    for (let k = 1; k < 16; k++) {
      const a = -Math.PI / 2 - (k / 16) * Math.PI;
      pts.push(new THREE.Vector2(-b.half + Math.cos(a) * (b.t / 2), curve(-b.half) + Math.sin(a) * (b.t / 2)));
    }
    // the lean
    return new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x * c - p.y * s, p.x * s + p.y * c)));
  });
  // cut fine enough that, laid on the sphere, the shape follows its curve
  let g: THREE.BufferGeometry = new THREE.ShapeGeometry(shapes);
  g = new TessellateModifier(0.05, 8).modify(g);
  const flat = g.getAttribute("position");
  const out = new Float32Array(flat.count * 2 * 3);
  // just above every tile (tiles stand to about 1.02 with their tilt), so tiles that only partly
  // overlap a bar are hidden under it and its edge stays clean
  const R = 1.034;
  for (let k = 0; k < flat.count; k++) {
    const x = flat.getX(k);
    const y = flat.getY(k);
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    out.set([x * R, y * R, z * R], k * 3);
    out.set([-x * R, y * R, -z * R], (flat.count + k) * 3);
  }
  const bars = new THREE.BufferGeometry();
  bars.setAttribute("position", new THREE.BufferAttribute(out, 3));
  bars.computeVertexNormals();
  g.dispose();
  return bars;
}

/**
 * The tiles' material: bright green-tinted mirror (lit by the studio's panels), with three touches
 * so it reads like the reference rather than a dark sphere with one hot spot. Every tile glows
 * faintly green on its own, so the ball holds up against black; a soft gradient brightens the side
 * facing the light (up and to the left on screen); and only a scattering of the tiles there flash,
 * each by its own random number, so the highlight is many separate tiles, never one patch.
 */
function tileMaterial(glow: { value: number }) {
  const m = new THREE.MeshStandardMaterial({ color: "#2fe07a", metalness: 0.65, roughness: 0.22, envMapIntensity: 1.8 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.uniforms.uLightDir = { value: new THREE.Vector3(-0.62, 0.62, 0.48).normalize() };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aSeed;\nvarying float vSeed;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSeed = aSeed;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlow;\nuniform vec3 uLightDir;\nvarying float vSeed;")
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float facing = max(dot(normal, uLightDir), 0.0);
        float lit = 0.32 + 0.9 * pow(facing, 1.6);
        float flash = smoothstep(0.78, 0.98, vSeed) * pow(facing, 5.0);
        totalEmissiveRadiance += uGlow * (vec3(0.05, 0.36, 0.15) * lit * (0.55 + 0.9 * vSeed) + vec3(0.55, 1.0, 0.72) * flash * 0.9);`,
      );
  };
  m.customProgramCacheKey = () => "disco-tiles-2";
  return m;
}

// ---------- the ring ----------

const RING_N = 256;
const RING_R = 1.3;
const RING_W = 0.065;
/** Angle of a point `t` (0 … 1) round the ring: from the top, clockwise. */
const ringAngle = (t: number) => Math.PI / 2 - t * Math.PI * 2;
/** A thin flat ribbon round a circle, starting at the top and running clockwise; drawn from tail to head. */
function ringGeometry(radius: number, width: number) {
  const pos = new Float32Array(RING_N * 2 * 3);
  for (let i = 0; i < RING_N; i++) {
    const a = ringAngle(i / (RING_N - 1));
    const c = Math.cos(a);
    const s = Math.sin(a);
    pos.set([c * (radius - width / 2), s * (radius - width / 2), 0, c * (radius + width / 2), s * (radius + width / 2), 0], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const idx: number[] = [];
  for (let i = 0; i < RING_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  g.setIndex(idx);
  return g;
}

// ---------- the black screen ----------

const curtainVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Black, with soft flecks of greenish light drifting slowly across it (two layers of sparse cells,
 * each fleck fading in and out), and the grain dissolve: the screen is cut into fine grains a couple
 * of pixels across, and each grain goes at its own moment, set by its distance from the ball plus a
 * random share, with a short soft fade, so it crumbles away rather than wipes.
 */
const curtainFragment = /* glsl */ `
  uniform float uTime;
  uniform float uDissolve;
  uniform float uDots;
  uniform float uAspect;
  uniform float uGrain;
  uniform vec3 uColor;
  uniform vec2 uOrigin;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float flecks(vec2 p, float scale, float speed, float seed) {
    vec2 q = p * scale + vec2(uTime * speed, sin(uTime * 0.07 + seed) * 0.6);
    vec2 cell = floor(q);
    vec2 f = fract(q) - 0.5;
    float keep = step(0.72, hash(cell + seed));
    vec2 o = vec2(hash(cell + seed + 1.3), hash(cell + seed + 4.1)) - 0.5;
    float r = 0.05 + 0.08 * hash(cell + seed + 9.2);
    float twinkle = 0.5 + 0.5 * sin(uTime * (0.6 + hash(cell + seed + 2.7)) + hash(cell) * 6.283);
    return keep * twinkle * smoothstep(r, r * 0.2, length(f - o * 0.6));
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float light = flecks(p, 9.0, 0.018, 0.0) * 0.7 + flecks(p, 16.0, -0.012, 17.0) * 0.45;
    vec3 col = uColor + vec3(0.55, 1.0, 0.7) * light * 0.09 * uDots;

    float grain = hash(floor(gl_FragCoord.xy / uGrain));
    // outward from the ball (wherever it has landed), reaching the farthest corner last
    vec2 far = max(uOrigin, 1.0 - uOrigin) * vec2(uAspect, 1.0);
    float reach = length((vUv - uOrigin) * vec2(uAspect, 1.0)) / length(far);
    float when = reach * 0.55 + grain * 0.45;
    // each grain fades out over a short while rather than popping, so the edge reads as fine dust
    float alive = 1.0 - smoothstep(when, when + 0.16, uDissolve * 1.16);
    if (alive <= 0.002) discard;
    gl_FragColor = vec4(col, alive);
  }
`;

// ---------- the intro ----------

export function Intro({ live, onPhase }: { live: LiveRef; onPhase: (p: IntroPhase) => void }) {
  const { camera, size, viewport, gl } = useThree();
  const ball = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const capHead = useRef<THREE.Mesh>(null);
  const capTail = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Group>(null);
  const curtain = useRef<THREE.Mesh>(null);
  const glow = useMemo(() => ({ value: 0 }), []);
  // `spun` is the ball's own slow turn: it holds still, face on, until loading is complete
  const a = useRef({ scale: 0, glow: 0, ring: 0, head: 0, tail: 0, dissolve: 0, dots: 0, fly: 0, turn: 0, spun: 0, finishing: false, appeared: false, steady: 0, entered: false, drawn: false });

  const parts = useMemo(() => {
    const { mats, shades, seeds } = buildTiles();
    const tile = new THREE.BoxGeometry(1, 1, 1);
    tile.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
    const tiles = new THREE.InstancedMesh(tile, tileMaterial(glow), mats.length);
    const col = new THREE.Color();
    mats.forEach((m, i) => {
      tiles.setMatrixAt(i, m);
      tiles.setColorAt(i, col.setScalar(shades[i]));
    });
    tiles.instanceMatrix.needsUpdate = true;
    tiles.raycast = NO_RAY;
    tiles.frustumCulled = false;
    // the dark core between the tiles, and the bars: matte black
    const core = new THREE.MeshStandardMaterial({ color: "#050706", roughness: 0.7, metalness: 0, envMapIntensity: 0.15 });
    const barsGeo = buildBars();
    const barsMat = new THREE.MeshStandardMaterial({ color: "#030303", roughness: 0.55, metalness: 0, envMapIntensity: 0.25, side: THREE.DoubleSide });
    // (double-sided: the ribbon runs clockwise, so its faces point away from the camera)
    // the line writes depth, so its round end caps (drawn just behind it) never double up the colour where they overlap it
    const ringMat = new THREE.MeshBasicMaterial({ color: "#1ed760", toneMapped: false, transparent: true, opacity: 0, depthWrite: true, side: THREE.DoubleSide });
    const capGeo = new THREE.CircleGeometry(RING_W / 2, 20);
    const trackMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ringGeo = ringGeometry(RING_R, RING_W);
    const trackGeo = ringGeometry(RING_R, RING_W);
    const curtainMat = new THREE.ShaderMaterial({
      vertexShader: curtainVertex,
      fragmentShader: curtainFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uDissolve: { value: 0 },
        uDots: { value: 0 },
        uAspect: { value: 1 },
        uGrain: { value: 2 },
        uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
        // a raw shader writes straight to the screen (no colour conversion), so this is #121212 as it shows
        uColor: { value: new THREE.Vector3(0x12 / 255, 0x12 / 255, 0x12 / 255) },
      },
    });
    return { tiles, core, barsGeo, barsMat, ringMat, trackMat, ringGeo, trackGeo, capGeo, curtainMat };
  }, [glow]);
  useEffect(
    () => () => {
      parts.tiles.geometry.dispose();
      [parts.ringGeo, parts.trackGeo, parts.barsGeo, parts.capGeo].forEach((g) => g.dispose());
      [parts.core, parts.barsMat, parts.ringMat, parts.trackMat, parts.curtainMat].forEach((m) => m.dispose());
    },
    [parts],
  );

  // 2. the ball arrives: scales up out of the black with the light coming up on it, then the ring's
  // track. It waits for the frames to run steady first, so the first frames' heavy work (compiling
  // every album's shaders) happens on the plain black screen, never during the entrance.
  const tl = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => () => void tl.current?.kill(), []);
  const enter = () => {
    const s = a.current;
    s.entered = true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      Object.assign(s, { scale: 1, glow: 1, ring: 1, dots: 1, appeared: true });
      return;
    }
    tl.current = gsap
      .timeline({
        onComplete: () => {
          s.appeared = true;
        },
      })
      .to(s, { scale: 1, duration: 1.1, ease: "back.out(1.35)" }, 0)
      .to(s, { glow: 1, duration: 1.4, ease: "power2.out" }, 0.1)
      .to(s, { dots: 1, duration: 1.6, ease: "power1.out" }, 0.3)
      .to(s, { ring: 1, duration: 0.5, ease: "power1.out" }, 0.8);
  };

  // 3–5. once loading is complete and the ring has caught up: the ring flows away, the ball turns once
  // and flies to the top bar, then the black screen crumbles away outwards from it
  const finish = () => {
    const s = a.current;
    s.finishing = true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      Object.assign(s, { tail: 1, ring: 0, dissolve: 1, dots: 0, fly: 1 });
      onPhase("revealing");
      onPhase("done");
      return;
    }
    gsap
      .timeline()
      .to(s, { tail: 1, duration: 0.8, ease: "power2.in" }, 0)
      .to(s, { ring: 0, duration: 0.3, ease: "power1.in" }, 0.6)
      .to(s, { turn: Math.PI * 2, duration: 1.5, ease: "power2.inOut" }, 0.7)
      .to(s, { fly: 1, duration: 1.4, ease: "power3.inOut" }, 0.8)
      .to(s, { glow: 0.55, duration: 1.4, ease: "power2.inOut" }, 0.8)
      .add(() => onPhase("revealing"), 2.25)
      .to(s, { dissolve: 1, duration: 1.7, ease: "power1.inOut" }, 2.25)
      .to(s, { dots: 0, duration: 1.0, ease: "power1.in" }, 2.25)
      .add(() => onPhase("done"), 3.95);
  };

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = a.current;
    const L = live.current;
    if (!ball.current || !spin.current || !ring.current || !curtain.current || !capHead.current || !capTail.current) return;
    if (!s.drawn) {
      s.drawn = true;
      onPhase("drawn");
    }
    if (!s.entered) {
      // steady = a run of frames under 50 ms (so a 30 fps device qualifies too); and never wait
      // longer than 1.6 s whatever the device
      s.steady = raw < 0.05 ? s.steady + 1 : 0;
      if (s.steady >= 8 || state.clock.elapsedTime > 1.6) enter();
    }

    // the ring's head follows the real progress smoothly, and never runs ahead of it
    const target = L.intro.target;
    s.head = Math.min(target, s.head + (target - s.head) * (1 - Math.exp(-dt / 0.35)) + dt * 0.02);
    if (target >= 1 && s.head > 0.998) s.head = 1;
    if (!s.finishing && s.appeared && s.head >= 1) finish();

    // where the ball is: the middle of the screen, or the logo slot in the top bar
    const vp = viewport.getCurrentViewport(camera, tmp.set(0, 0, Z_BALL));
    const mid = Math.min(vp.height * 0.13, vp.width * 0.2);
    let x = 0;
    let y = vp.height * 0.02;
    let r = mid;
    const slot = L.logoSlot;
    if (slot && s.fly > 0) {
      const tx = (slot.x / size.width - 0.5) * vp.width;
      const ty = (0.5 - slot.y / size.height) * vp.height;
      const tr = (slot.size / 2 / size.height) * vp.height;
      const f = s.fly;
      // a gentle arc on the way up
      x += (tx - x) * f;
      y += (ty - y) * f + Math.sin(f * Math.PI) * vp.height * 0.04;
      r += (tr - r) * f;
    }
    ball.current.position.set(x, y, Z_BALL);
    ball.current.scale.setScalar(Math.max(0.0001, r * s.scale));
    // still and face on while loading; turning from the moment it completes (slower once in the top bar)
    if (s.finishing) s.spun += dt * (s.fly >= 1 ? 0.35 : 0.5);
    spin.current.rotation.set(0.1, s.spun + s.turn, 0);
    glow.value = s.glow;

    ring.current.visible = s.ring > 0.001;
    ring.current.position.set(0, vp.height * 0.02, Z_BALL);
    ring.current.scale.setScalar(Math.max(0.0001, mid * s.scale));
    parts.ringMat.opacity = s.ring;
    parts.trackMat.opacity = s.ring * 0.12;
    const from = Math.floor(Math.min(s.tail, s.head) * (RING_N - 1));
    const to = Math.floor(s.head * (RING_N - 1));
    parts.ringGeo.setDrawRange(from * 6, Math.max(0, to - from) * 6);
    // round caps on the line's two ends; once it closes the full circle the ends meet and merge
    // into one seamless loop, so the caps go
    const ends = to > from && !(from === 0 && to === RING_N - 1);
    capHead.current.visible = capTail.current.visible = ends;
    const place = (m: THREE.Mesh, t: number) => m.position.set(Math.cos(ringAngle(t)) * RING_R, Math.sin(ringAngle(t)) * RING_R, -0.002);
    place(capHead.current, to / (RING_N - 1));
    place(capTail.current, from / (RING_N - 1));

    const cv = viewport.getCurrentViewport(camera, tmp.set(0, 0, Z_CURTAIN));
    curtain.current.visible = s.dissolve < 1;
    curtain.current.position.set(0, 0, Z_CURTAIN);
    curtain.current.scale.set(cv.width * 1.02, cv.height * 1.02, 1);
    const u = parts.curtainMat.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uDissolve.value = s.dissolve;
    u.uDots.value = s.dots;
    u.uAspect.value = size.width / size.height;
    u.uGrain.value = 1.5 * gl.getPixelRatio();
    u.uOrigin.value.set(x / vp.width + 0.5, y / vp.height + 0.5);
  });

  return (
    <>
      <mesh ref={curtain} material={parts.curtainMat} renderOrder={10} raycast={NO_RAY}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={ball}>
        <group ref={spin}>
          <primitive object={parts.tiles} />
          <mesh material={parts.core} raycast={NO_RAY}>
            <sphereGeometry args={[0.99, 48, 32]} />
          </mesh>
          <mesh geometry={parts.barsGeo} material={parts.barsMat} raycast={NO_RAY} />
        </group>
      </group>
      <group ref={ring}>
        <mesh geometry={parts.trackGeo} material={parts.trackMat} renderOrder={12} raycast={NO_RAY} />
        <mesh geometry={parts.ringGeo} material={parts.ringMat} renderOrder={13} raycast={NO_RAY} />
        <mesh ref={capHead} geometry={parts.capGeo} material={parts.ringMat} renderOrder={14} raycast={NO_RAY} />
        <mesh ref={capTail} geometry={parts.capGeo} material={parts.ringMat} renderOrder={14} raycast={NO_RAY} />
      </group>
    </>
  );
}
