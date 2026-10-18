// Geometry builders. Units are centimetres; every part is built at its real size.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const cache = new Map<string, THREE.BufferGeometry>();
/** Build a geometry once per key and share it between every mesh that uses it. */
export function memo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = cache.get(key) as T | undefined;
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

export function roundedRect<T extends THREE.Path>(path: T, x: number, y: number, w: number, h: number, r: number): T {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  if (r) path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  if (r) path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  if (r) path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  if (r) path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

export const circle = (cx: number, cy: number, r: number, clockwise = false) => {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, clockwise);
  return p;
};
export const rectPath = (x: number, y: number, w: number, h: number, r = 0) => roundedRect(new THREE.Path(), x, y, w, h, r);
export const polyShape = (pts: [number, number][]) => {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
};

/** Extrude a 2D shape (x, y) along +z by depth, with an optional small bevel. Centred on z if `centre`. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0, curve = 24, centre = false) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * bevel),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curve,
  });
  g.translate(0, 0, centre ? -depth / 2 + bevel : bevel);
  return g;
}

/** A square fan frame: rounded square with the round throat and four screw holes, depth along z, centred. */
export function fanFrame(size: number, depth: number, throat: number) {
  return memo(`fanframe:${size}:${depth}:${throat}`, () => {
    const h = size / 2;
    const s = roundedRect(new THREE.Shape(), -h, -h, size, size, size * 0.075);
    s.holes.push(circle(0, 0, throat, true));
    const k = h - size * 0.068;
    for (const [x, y] of [[-k, -k], [k, -k], [k, k], [-k, k]]) s.holes.push(circle(x, y, size * 0.019, true));
    return extrude(s, depth, 0.06, 48, true);
  });
}

/**
 * Fan blades as one geometry: `count` swept, twisted, cambered blades between the hub and the tip,
 * around the z axis, sitting within ±depth/2. Each blade is a thin closed solid so it reads from both sides.
 */
export function fanBlades({ hub, tip, count, depth, sweep = 0.55, rootChord = 0.95, tipChord = 0.62, rootPitch = 46, tipPitch = 28, thick = 0.07 }: { hub: number; tip: number; count: number; depth: number; sweep?: number; rootChord?: number; tipChord?: number; rootPitch?: number; tipPitch?: number; thick?: number }) {
  return memo(`blades:${hub}:${tip}:${count}:${depth}:${sweep}:${rootChord}:${tipChord}`, () => {
    const nr = 12;
    const nc = 9;
    const span = (Math.PI * 2) / count;
    const one = (a0: number) => {
      const pos: number[] = [];
      const idx: number[] = [];
      const point = (i: number, j: number, side: number) => {
        const s = i / (nr - 1);
        const t = j / (nc - 1);
        const r = hub + (tip - hub) * s;
        const chord = span * (rootChord + (tipChord - rootChord) * s);
        const centre = a0 + sweep * Math.pow(s, 1.25);
        const a = centre + (t - 0.5) * chord;
        const pitch = ((rootPitch + (tipPitch - rootPitch) * s) * Math.PI) / 180;
        let z = (t - 0.5) * chord * r * Math.tan(pitch);
        const limit = depth / 2 - 0.05;
        z = Math.max(-limit, Math.min(limit, z));
        const camber = 0.12 * (1 - (2 * t - 1) ** 2) * (0.6 + 0.4 * s);
        return [r * Math.cos(a), r * Math.sin(a), z + camber + side * thick * 0.5];
      };
      // two skins
      for (const side of [1, -1]) for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) pos.push(...point(i, j, side));
      const at = (side: number, i: number, j: number) => (side > 0 ? 0 : nr * nc) + i * nc + j;
      for (let i = 0; i < nr - 1; i++)
        for (let j = 0; j < nc - 1; j++) {
          const a = at(1, i, j), b = at(1, i + 1, j), c = at(1, i + 1, j + 1), d = at(1, i, j + 1);
          idx.push(a, b, c, a, c, d);
          const e = at(-1, i, j), f = at(-1, i + 1, j), g = at(-1, i + 1, j + 1), h = at(-1, i, j + 1);
          idx.push(e, g, f, e, h, g);
        }
      // rims round the four sides
      const rim = (list: [number, number][]) => {
        for (let k = 0; k < list.length - 1; k++) {
          const [i0, j0] = list[k];
          const [i1, j1] = list[k + 1];
          const a = at(1, i0, j0), b = at(1, i1, j1), c = at(-1, i1, j1), d = at(-1, i0, j0);
          idx.push(a, c, b, a, d, c);
        }
      };
      const edge: [number, number][] = [];
      for (let j = 0; j < nc; j++) edge.push([nr - 1, j]);
      for (let i = nr - 2; i >= 0; i--) edge.push([i, nc - 1]);
      for (let j = nc - 2; j >= 0; j--) edge.push([0, j]);
      for (let i = 1; i < nr; i++) edge.push([i, 0]);
      rim(edge);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    const parts = Array.from({ length: count }, (_, k) => one(k * span));
    const merged = mergeGeometries(parts, false)!;
    merged.computeVertexNormals();
    return merged;
  });
}

/** Thin plate with holes cut from a rectangle (x, y), extruded along z. */
export function plate(w: number, h: number, depth: number, holes: THREE.Path[] = [], r = 0, bevel = 0) {
  const s = roundedRect(new THREE.Shape(), -w / 2, -h / 2, w, h, r);
  s.holes.push(...holes);
  return extrude(s, depth, bevel, 32, true);
}

/** A solid 3D tube along a smooth curve through points. */
export function tube(points: THREE.Vector3[], radius: number, segments = 64, radial = 14) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
  return new THREE.TubeGeometry(curve, segments, radius, radial, false);
}

/** A canvas texture for printed or lit text. */
export function textTexture(text: string, { w = 512, h = 64, font = "600 40px Arial, sans-serif", color = "#111", bg = "transparent", spacing = 0, align = "center" as CanvasTextAlign } = {}) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  if (bg !== "transparent") {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = color;
  g.font = font;
  g.textAlign = align;
  g.textBaseline = "middle";
  // letter spacing for the GeForce-style lettering
  (g as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  g.fillText(text, align === "center" ? w / 2 : 8, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft round shadow for under the case. */
export function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, "rgba(0,0,0,0.30)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * A cable harness: one strand per (ox, oy) offset in the bundle's cross-section, carried along a smooth
 * centreline with its Frenet frames, so the strands stay side by side through every bend.
 */
export function harness(points: THREE.Vector3[], layout: [number, number][], r: number, { up = new THREE.Vector3(0, 0, 1), segments = 48, radial = 7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
  // parallel transport, starting from `up`, so the strands keep their pin order through every bend
  const T: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) T.push(curve.getTangentAt(i / segments));
  let n = up.clone().sub(T[0].clone().multiplyScalar(up.dot(T[0]))).normalize();
  const N = [n.clone()];
  for (let i = 1; i <= segments; i++) {
    const axis = new THREE.Vector3().crossVectors(T[i - 1], T[i]);
    const len = axis.length();
    if (len > 1e-6) n = n.clone().applyAxisAngle(axis.divideScalar(len), Math.acos(Math.min(1, Math.max(-1, T[i - 1].dot(T[i])))));
    N.push(n.clone());
  }
  return layout.map(([ox, oy]) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const b = new THREE.Vector3().crossVectors(T[i], N[i]);
      pts.push(curve.getPointAt(i / segments).add(N[i].clone().multiplyScalar(ox)).add(b.multiplyScalar(oy)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5), segments, r, radial, false);
  });
}

/** Strand offsets for a connector with `rows` × `cols` pins at `pitch` (cm). */
export const grid = (rows: number, cols: number, pitch: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) out.push([(i - (rows - 1) / 2) * pitch, (j - (cols - 1) / 2) * pitch]);
  return out;
};
