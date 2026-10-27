// Geometry built in code: a board panel with rounded corners whose two faces carry separate prints.
import * as THREE from "three";

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * A square panel `s` wide and `t` thick, centred, with corners rounded by `r`. Material groups:
 * 0 = the −z face, 1 = the +z face, 2 = the cut edge. Both faces map 0…1 across the square the way
 * they read when you look straight at them.
 */
export function panelGeometry(s: number, t: number, r: number) {
  const key = `${s}|${t}|${r}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = s / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-h + r, -h);
  shape.lineTo(h - r, -h);
  shape.quadraticCurveTo(h, -h, h, -h + r);
  shape.lineTo(h, h - r);
  shape.quadraticCurveTo(h, h, h - r, h);
  shape.lineTo(-h + r, h);
  shape.quadraticCurveTo(-h, h, -h, h - r);
  shape.lineTo(-h, -h + r);
  shape.quadraticCurveTo(-h, -h, -h + r, -h);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -t / 2);
  // ExtrudeGeometry puts both lids in its first group, the back lid first; split them
  const lids = g.groups[0];
  const half = lids.count / 2;
  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = lids.start; i < lids.start + lids.count; i++) {
    const x = (pos.getX(i) + h) / s;
    const y = (pos.getY(i) + h) / s;
    // seen from behind, the back face's left is +x
    uv.setXY(i, i < lids.start + half ? 1 - x : x, y);
  }
  uv.needsUpdate = true;
  const edge = g.groups[1];
  g.clearGroups();
  g.addGroup(lids.start, half, 0);
  g.addGroup(lids.start + half, half, 1);
  g.addGroup(edge.start, edge.count, 2);
  cache.set(key, g);
  return g;
}
