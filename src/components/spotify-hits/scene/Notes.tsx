"use client";
// Music notes that drift out from behind the disc while the song plays, in Spotify green: each starts
// under the disc (the disc hides it), slides out past the rim on a gentle curve, drifting up and
// swaying, then fades. A new one every fraction of a second, at a random angle, size and shape;
// when the music stops no new ones come and the last few fade out.
//
// A small fixed pool of sprites, made once and reused, so nothing is created while it plays; they are
// always "on" (at zero opacity when idle) so their shader is compiled in the intro's warm-up.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { R } from "./live";

const POOL = 14;
const EVERY = 0.3; // seconds between notes
const LIFE = [1.8, 2.6];
const GREEN = "#1ed760";

/** The note shapes, drawn in white as paths (no font needed, so they look the same everywhere). */
function glyphs() {
  const draw = (paint: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = g.strokeStyle = "#fff";
    g.lineCap = "round";
    paint(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const head = (g: CanvasRenderingContext2D, x: number, y: number) => {
    g.beginPath();
    g.ellipse(x, y, 19, 13.5, -0.42, 0, Math.PI * 2);
    g.fill();
  };
  const stem = (g: CanvasRenderingContext2D, x: number, y0: number, y1: number) => {
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x, y1);
    g.stroke();
  };
  return [
    // eighth note
    draw((g) => {
      head(g, 50, 96);
      stem(g, 66, 90, 18);
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(66, 20);
      g.bezierCurveTo(70, 44, 100, 46, 94, 74);
      g.stroke();
    }),
    // two beamed eighths
    draw((g) => {
      head(g, 32, 100);
      head(g, 90, 88);
      stem(g, 48, 94, 26);
      stem(g, 106, 82, 14);
      g.beginPath();
      g.moveTo(44, 22);
      g.lineTo(110, 8);
      g.lineTo(110, 24);
      g.lineTo(44, 38);
      g.closePath();
      g.fill();
    }),
    // quarter note
    draw((g) => {
      head(g, 54, 96);
      stem(g, 70, 90, 16);
    }),
    // two beamed sixteenths
    draw((g) => {
      head(g, 32, 102);
      head(g, 90, 92);
      stem(g, 48, 96, 24);
      stem(g, 106, 86, 14);
      for (const dy of [0, 20]) {
        g.beginPath();
        g.moveTo(44, 20 + dy);
        g.lineTo(110, 8 + dy);
        g.lineTo(110, 20 + dy);
        g.lineTo(44, 32 + dy);
        g.closePath();
        g.fill();
      }
    }),
  ];
}

let shapes: THREE.Texture[] | null = null;

interface Note {
  sprite: THREE.Sprite;
  age: number;
  life: number;
  angle: number;
  size: number;
  sway: number;
  spin: number;
}

export function Notes({ on }: { on: () => boolean }) {
  const group = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), up: new THREE.Vector3() }), []);
  const notes = useMemo<Note[]>(() => {
    shapes ??= glyphs();
    return Array.from({ length: POOL }, (_, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: shapes![i % shapes!.length], color: GREEN, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
      sprite.raycast = () => {};
      return { sprite, age: 1, life: 0, angle: 0, size: 0, sway: 0, spin: 0 };
    });
  }, []);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    // "up" on screen, in the disc's own frame (the open case turns upright on tall screens)
    let upX = 0;
    let upY = 1;
    if (group.current) {
      group.current.getWorldQuaternion(tmp.q).invert();
      tmp.up.set(0, 1, 0).applyQuaternion(tmp.q);
      const len = Math.hypot(tmp.up.x, tmp.up.y) || 1;
      upX = tmp.up.x / len;
      upY = tmp.up.y / len;
    }
    const upAngle = Math.atan2(upY, upX);
    if (on()) {
      clock.current += dt;
      if (clock.current >= EVERY) {
        clock.current = 0;
        const free = notes.find((n) => n.age >= n.life);
        if (free) {
          // mostly from the upper half, as if the music rises off the disc
          free.angle = upAngle + (Math.random() - 0.5) * Math.PI * 1.5;
          free.life = LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]);
          free.age = 0;
          free.size = R * (0.13 + Math.random() * 0.1);
          free.sway = (Math.random() - 0.5) * 2;
          free.spin = (Math.random() - 0.5) * 0.6;
          free.sprite.material.map = shapes![Math.floor(Math.random() * shapes!.length)];
        }
      }
    }
    for (const n of notes) {
      const m = n.sprite.material;
      if (n.age >= n.life) {
        m.opacity = 0;
        continue;
      }
      n.age += dt;
      const k = Math.min(1, n.age / n.life);
      const ease = 1 - Math.pow(1 - k, 2.2);
      // out from under the disc, past the rim, drifting up and swaying a little as it goes
      const r = R * (0.55 + 1.05 * ease);
      const wob = Math.sin(k * Math.PI * 2 + n.sway) * R * 0.05;
      const x = Math.cos(n.angle) * r + upX * R * 0.35 * ease - upY * wob;
      const y = Math.sin(n.angle) * r + upY * R * 0.35 * ease + upX * wob;
      // at the disc's middle depth, so the disc hides it until it clears the rim
      n.sprite.position.set(x, y, 0);
      n.sprite.scale.setScalar(n.size * (0.7 + 0.3 * ease));
      m.rotation = n.spin * Math.sin(k * Math.PI) + n.sway * 0.15;
      m.opacity = Math.min(1, n.age / 0.25) * (1 - Math.max(0, (k - 0.6) / 0.4)) * 0.95;
    }
  });

  return (
    <group ref={group}>
      {notes.map((n, i) => (
        <primitive key={i} object={n.sprite} />
      ))}
    </group>
  );
}
