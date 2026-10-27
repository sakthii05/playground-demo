// The jewel case's shapes, built once and shared by every album. The clear plates are plain boxes
// (their faces and cut edges take different materials); everything else that is moulded plastic
// (walls, rims, hinge knuckles, booklet clips, the tray's walls, hub and corner ridges) is merged
// into one geometry per moving part, so the whole case is only a handful of draw calls.
//
// Across (x, mm, the panel centred on 0): the case runs from −74 (outside the hinge strip) to +68.
// The base's walls stand just inside that, the insert lies inside the walls with its spines folded
// up against them, and the tray sits inside the spines, round the disc.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CASE, HUB, MM, PAPER, R, Z } from "./live";

const L = -CASE.panel / 2 - CASE.hinge; // left edge of the case (outside the hinge strip)
const RIGHT = CASE.panel / 2;
const CX = (L + RIGHT) / 2; // centre of the whole footprint (the panel is centred on 0)
const HH = CASE.h / 2;
const WALL = 1 * MM;
/** The tray: inside the spines, round the disc. */
const TRAY = { w: 130 * MM, h: 119 * MM };

/** The hinge axis: along y, at the middle of the hinge strip and of the lid plate's thickness. */
export const HINGE = { x: -CASE.panel / 2 - CASE.hinge / 2, z: (Z.lid + Z.top) / 2 };

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

let cache: ReturnType<typeof build> | null = null;
export const caseGeometry = () => (cache ??= build());

function build() {
  const footW = RIGHT - L;
  // the two clear plates, full footprint, and the tray's plate
  const backPlate = box(footW, CASE.h, -Z.back, CX, 0, Z.back / 2);
  const lidPlate = box(footW, CASE.h, Z.top - Z.lid, CX, 0, (Z.lid + Z.top) / 2);
  const trayPlate = box(TRAY.w, TRAY.h, Z.trayTop - Z.tray, 0, 0, (Z.tray + Z.trayTop) / 2);

  // base frame: outer walls all round (the left one behind the hinge strip); the tray's own walls
  // down to the insert; the hub with its ring of petals; the disc's seat; corner finger ridges
  const base: THREE.BufferGeometry[] = [];
  const wallH = Z.wall - Z.back;
  const wallZ = (Z.wall + Z.back) / 2;
  const innerY = HH - 1.5 * WALL; // centre of the top / bottom walls
  base.push(box(footW, WALL, wallH, CX, innerY, wallZ), box(footW, WALL, wallH, CX, -innerY, wallZ));
  base.push(box(WALL, 2 * innerY, wallH, RIGHT - 1.5 * WALL, 0, wallZ));
  base.push(box(WALL, 2 * innerY, wallH, L + 1.5 * WALL, 0, wallZ));
  const tH = Z.trayTop - Z.inlay - PAPER.thick;
  const tZ = (Z.trayTop + Z.inlay + PAPER.thick) / 2;
  const tw = 0.8 * MM;
  base.push(box(TRAY.w, tw, tH, 0, TRAY.h / 2 - tw / 2, tZ), box(TRAY.w, tw, tH, 0, -TRAY.h / 2 + tw / 2, tZ));
  base.push(box(tw, TRAY.h, tH, -TRAY.w / 2 + tw / 2, 0, tZ), box(tw, TRAY.h, tH, TRAY.w / 2 - tw / 2, 0, tZ));
  base.push(new THREE.CylinderGeometry(HUB.r * 0.94, HUB.r, HUB.top - Z.trayTop, 36).rotateX(Math.PI / 2).translate(0, 0, (HUB.top + Z.trayTop) / 2));
  for (let i = 0; i < 12; i++) {
    // the hub's petals, standing on the tray round it
    const a = (i / 12) * Math.PI * 2;
    const r = HUB.r * 1.45;
    base.push(new THREE.BoxGeometry(HUB.r * 0.7, 0.9 * MM, 1.2 * MM).rotateZ(a).translate(Math.cos(a) * r, Math.sin(a) * r, Z.trayTop + 0.6 * MM));
  }
  base.push(new THREE.TorusGeometry(HUB.r * 1.95, 0.45 * MM, 6, 48).translate(0, 0, Z.trayTop + 0.3 * MM));
  base.push(new THREE.TorusGeometry(R * 0.995, 0.45 * MM, 6, 96).translate(0, 0, Z.trayTop + 0.25 * MM)); // the disc's seat
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    // a quarter ridge in each corner, round the finger notch
    const g = new THREE.TorusGeometry(9 * MM, 0.5 * MM, 6, 20, Math.PI / 2);
    g.rotateZ(sx > 0 ? (sy > 0 ? Math.PI : Math.PI / 2) : sy > 0 ? -Math.PI / 2 : 0);
    base.push(g.translate(sx * (TRAY.w / 2), sy * (TRAY.h / 2), Z.trayTop + 0.3 * MM));
  }

  // lid frame: rim lips top, bottom and right (outside the base's walls), two hinge knuckles, and
  // the two clips that hold the booklet's open edge
  const lid: THREE.BufferGeometry[] = [];
  const rimH = Z.top - Z.rim;
  const rimZ = (Z.top + Z.rim) / 2;
  lid.push(box(footW, WALL, rimH, CX, HH - WALL / 2, rimZ), box(footW, WALL, rimH, CX, -HH + WALL / 2, rimZ));
  lid.push(box(WALL, CASE.h, rimH, RIGHT - WALL / 2, 0, rimZ));
  for (const y of [HH - 8 * MM, -HH + 8 * MM]) lid.push(new THREE.CylinderGeometry(2.2 * MM, 2.2 * MM, 12 * MM, 16).translate(HINGE.x, y, HINGE.z));
  const clipX = PAPER.bookX + PAPER.bookW / 2 - 0.8 * MM;
  for (const y of [32 * MM, -32 * MM]) lid.push(box(3 * MM, 9 * MM, Z.lid - Z.book + 0.6 * MM, clipX, y, (Z.lid + Z.book) / 2 - 0.3 * MM));

  return {
    backPlate,
    lidPlate,
    trayPlate,
    baseFrame: mergeGeometries(base.map((g) => g.toNonIndexed()))!,
    lidFrame: mergeGeometries(lid.map((g) => g.toNonIndexed()))!,
    booklet: box(PAPER.bookW, PAPER.bookH, Z.lid - Z.book, PAPER.bookX, 0, (Z.lid + Z.book) / 2),
    inlay: box(PAPER.inlayW, PAPER.inlayH, PAPER.thick, PAPER.inlayX, 0, Z.inlay + PAPER.thick / 2),
    spineL: spine(-1),
    spineR: spine(1),
    // plain boxes the pointer is tested against instead of the detailed parts: the base up to the
    // tray's top (so a lifted disc is in front of it), and the lid
    hitBase: box(footW, CASE.h, Z.trayTop - Z.back, CX, 0, (Z.trayTop + Z.back) / 2),
    hitLid: box(footW, CASE.h, Z.top - Z.rim, CX, 0, (Z.top + Z.rim) / 2),
  };
}

/**
 * A spine of the back insert, folded up from its edge: a strip standing on the insert's edge, facing
 * out against the wall. Its uv spans just its strip of the insert's image (spine | panel | spine),
 * with the image's outer edge at the top of the fold, as on a real case.
 */
function spine(side: -1 | 1) {
  const h = Z.tray - Z.inlay - PAPER.thick;
  const g = new THREE.PlaneGeometry(h, PAPER.inlayH);
  const total = PAPER.inlayW + 2 * PAPER.spine;
  const outer = side < 0 ? 0 : 1;
  const inner = side < 0 ? PAPER.spine / total : (PAPER.spine + PAPER.inlayW) / total;
  // turned to face out, the plane's +x end points to the front on the left side, to the back on the right
  const frontAtPlusX = side < 0;
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) {
    const k = frontAtPlusX ? uv.getX(i) : 1 - uv.getX(i);
    uv.setX(i, inner + (outer - inner) * k);
  }
  g.rotateY(side < 0 ? -Math.PI / 2 : Math.PI / 2);
  const edge = PAPER.inlayX + side * PAPER.inlayW / 2;
  g.translate(edge + side * 0.15 * MM, 0, Z.inlay + PAPER.thick + h / 2);
  return g;
}
