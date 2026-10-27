// Textures. Album art comes from public/spotify-hits/<slug>/ when the file exists; anything missing
// is drawn on a canvas from the track's data in the page's own fonts, so every album looks finished.
// The disc label is always made from the front cover. Surface detail (paper grain, the print's dot
// screen, the data side's tracks) is generated here too, so none of it is a download.
import * as THREE from "three";
import { fileUrl, formatTime, type ArtFile, type Track } from "../data/tracks";
import { R, S } from "./live";

// drawn art sizes: the front (and the disc label made from it) is seen largest
const ART = 1024;
const PANEL = 768;

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function texture(src: HTMLCanvasElement | HTMLImageElement, color = true) {
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function repeating(c: HTMLCanvasElement, n: number) {
  const t = texture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(n, n);
  return t;
}

// ---------- surfaces, shared by every album ----------

let grain: THREE.Texture | null = null;
/** Fine paper fibre, for the board's bump. */
export function paperGrain() {
  if (grain) return grain;
  const [c, g] = canvas(256);
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 20 + (Math.random() < 0.02 ? 30 : 0);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (grain = repeating(c, 6));
}

let dots: THREE.Texture | null = null;
/** The printer's dot screen on the disc label: shows only in the highlight, as on a real CD. */
export function printScreen() {
  if (dots) return dots;
  const [c, g] = canvas(128);
  g.fillStyle = "#9a9a9a";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#5c5c5c";
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      g.beginPath();
      g.arc(x * 8 + (y % 2) * 4, y * 8 + 4, 1.8 + Math.random() * 0.8, 0, Math.PI * 2);
      g.fill();
    }
  return (dots = repeating(c, 14));
}

let back: THREE.Texture | null = null;
/**
 * The data side's colour: a bright mirror band round the hub, the written area a shade darker with a
 * faint dye tint, and a lighter lead-out ring at the edge, with soft grading between them. The rings
 * are kept broad: fine ones shimmer (moiré) as the disc turns.
 * (three's anisotropic material would streak the highlights along the tracks, but it drops some GPUs
 * to a few frames a second, so it is not used.)
 */
export function dataSide() {
  if (back) return back;
  const N = 1024;
  const [c, g] = canvas(N);
  const ramp = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  ramp.addColorStop(0.3, "#c9ccd0"); // mirror band at the hub
  ramp.addColorStop(0.43, "#b4b8bd");
  ramp.addColorStop(0.47, "#5a6169"); // data starts: darker, with the dye's faint green-blue cast
  ramp.addColorStop(0.75, "#4f5960");
  ramp.addColorStop(0.95, "#5b646b");
  ramp.addColorStop(0.97, "#b7bbc0"); // lead-out
  ramp.addColorStop(1, "#c4c7cb");
  g.fillStyle = ramp;
  g.fillRect(0, 0, N, N);
  // a few faint session rings
  g.strokeStyle = "rgba(255,255,255,0.05)";
  for (const r of [0.52, 0.61, 0.7, 0.83]) {
    g.lineWidth = N * 0.006;
    g.beginPath();
    g.arc(N / 2, N / 2, (r * N) / 2, 0, Math.PI * 2);
    g.stroke();
  }
  return (back = texture(c));
}

let shadow: THREE.Texture | null = null;
/** A soft round shadow, for under the lifted disc. */
export function softShadow() {
  if (shadow) return shadow;
  const N = 256;
  const [c, g] = canvas(N);
  const r = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  r.addColorStop(0, "rgba(0,0,0,0.85)");
  r.addColorStop(0.55, "rgba(0,0,0,0.6)");
  r.addColorStop(0.8, "rgba(0,0,0,0.2)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, N, N);
  return (shadow = texture(c));
}

// ---------- album art ----------

export interface Art {
  front: THREE.Texture;
  back: THREE.Texture;
  inside: THREE.Texture;
  tray: THREE.Texture;
  label: THREE.Texture;
}

const font = (name: string) => {
  const el = document.querySelector("[data-sth]") ?? document.body;
  return getComputedStyle(el).getPropertyValue(name).trim() || "sans-serif";
};

const load = (url: string) =>
  new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = url;
  });

const ink = (hex: string) => {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.62 ? "#111111" : "#ffffff";
};
const shade = (hex: string, k: number) => `#${new THREE.Color(hex).lerp(new THREE.Color(k < 0 ? "#000" : "#fff"), Math.abs(k)).getHexString()}`;

function lines(g: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(" ")) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > width && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** A big title fitted to `width`, at most `max` px tall a line; returns the size used. */
function fit(g: CanvasRenderingContext2D, text: string, family: string, weight: number, width: number, max: number, rows = 3) {
  let px = max;
  for (; px > 20; px -= 4) {
    g.font = `${weight} ${px}px ${family}`;
    if (lines(g, text, width).length <= rows && Math.max(...text.split(" ").map((w) => g.measureText(w).width)) <= width) break;
  }
  return px;
}

function grainOver(g: CanvasRenderingContext2D, n: number, alpha: number) {
  const img = g.getImageData(0, 0, n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() - 0.5) * 255 * alpha;
    img.data[i] += v;
    img.data[i + 1] += v;
    img.data[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
}

function drawFront(t: Track) {
  const n = ART;
  const [c, g] = canvas(n);
  const fg = ink(t.color);
  const display = font("--sth-display");
  const sans = font("--sth-sans");
  const mono = font("--sth-mono");
  g.fillStyle = t.color;
  g.fillRect(0, 0, n, n);
  const light = g.createRadialGradient(n * 0.25, n * 0.2, 0, n * 0.25, n * 0.2, n * 1.1);
  light.addColorStop(0, "rgba(255,255,255,0.22)");
  light.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = light;
  g.fillRect(0, 0, n, n);
  // a large ring, the one shape every cover shares
  g.strokeStyle = fg === "#ffffff" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.14)";
  g.lineWidth = n * 0.09;
  g.beginPath();
  g.arc(n * 0.78, n * 0.3, n * 0.36, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = fg;
  g.font = `600 ${n * 0.03}px ${sans}`;
  g.fillText(t.mainArtist.toUpperCase(), n * 0.07, n * 0.1);
  g.font = `500 ${n * 0.026}px ${mono}`;
  g.textAlign = "right";
  g.fillText(`No. ${String(t.rank).padStart(2, "0")}`, n * 0.93, n * 0.1);
  g.textAlign = "left";
  const title = t.title.toUpperCase();
  const px = fit(g, title, display, 800, n * 0.86, n * 0.2);
  g.font = `800 ${px}px ${display}`;
  const rows = lines(g, title, n * 0.86);
  rows.forEach((row, i) => g.fillText(row, n * 0.07, n * 0.93 - (rows.length - 1 - i) * px * 0.9));
  grainOver(g, n, 0.06);
  return c;
}

function drawBack(t: Track) {
  const n = PANEL;
  const [c, g] = canvas(n);
  const bg = shade(t.color, -0.35);
  const fg = ink(bg);
  const sans = font("--sth-sans");
  const mono = font("--sth-mono");
  g.fillStyle = bg;
  g.fillRect(0, 0, n, n);
  g.fillStyle = fg;
  g.globalAlpha = 0.9;
  g.font = `500 ${n * 0.03}px ${mono}`;
  g.fillText("01.", n * 0.08, n * 0.12);
  g.font = `600 ${n * 0.034}px ${sans}`;
  g.fillText(t.title, n * 0.15, n * 0.12);
  g.font = `400 ${n * 0.028}px ${mono}`;
  g.textAlign = "right";
  g.fillText(formatTime(t.durationMs), n * 0.92, n * 0.12);
  g.textAlign = "left";
  g.globalAlpha = 0.6;
  g.font = `400 ${n * 0.022}px ${sans}`;
  [`${t.album} · ${t.year}`, `Written by ${t.writers.join(", ")}`, `Produced by ${t.producers.join(", ")}`].forEach((s, i) => {
    lines(g, s, n * 0.84).forEach((row, j) => g.fillText(row, n * 0.08, n * 0.2 + i * n * 0.075 + j * n * 0.03));
  });
  // barcode
  g.globalAlpha = 1;
  g.fillStyle = "#fff";
  g.fillRect(n * 0.08, n * 0.78, n * 0.26, n * 0.13);
  g.fillStyle = "#111";
  let x = n * 0.095;
  let seed = t.rank * 97;
  while (x < n * 0.325) {
    seed = (seed * 9301 + 49297) % 233280;
    const w = 1 + (seed % 4) * 1.6;
    g.fillRect(x, n * 0.79, w, n * 0.09);
    x += w + 2 + (seed % 3);
  }
  g.fillStyle = fg;
  g.globalAlpha = 0.6;
  g.font = `400 ${n * 0.02}px ${mono}`;
  g.textAlign = "right";
  g.fillText(`℗ ${t.year} · ${t.mainArtist}`, n * 0.92, n * 0.9);
  grainOver(g, n, 0.05);
  return c;
}

function drawInside(t: Track) {
  const n = PANEL;
  const [c, g] = canvas(n);
  const bg = shade(t.color, -0.15);
  const fg = ink(bg);
  const display = font("--sth-display");
  const sans = font("--sth-sans");
  g.fillStyle = bg;
  g.fillRect(0, 0, n, n);
  g.fillStyle = fg;
  const title = t.title.toUpperCase();
  const px = fit(g, title, display, 800, n * 0.6, n * 0.1);
  g.font = `800 ${px}px ${display}`;
  const rows = lines(g, title, n * 0.6);
  rows.forEach((row, i) => g.fillText(row, n * 0.09, n * 0.17 + i * px * 0.92));
  let y = n * 0.17 + rows.length * px * 0.92 + n * 0.03;
  g.fillRect(n * 0.09, y, n * 0.05, 3);
  y += n * 0.08;
  const block = (label: string, names: string[]) => {
    g.globalAlpha = 0.55;
    g.font = `600 ${n * 0.02}px ${sans}`;
    g.fillText(label.toUpperCase(), n * 0.09, y);
    g.globalAlpha = 0.95;
    g.font = `500 ${n * 0.027}px ${sans}`;
    names.forEach((name, i) => g.fillText(name, n * 0.09, y + n * 0.045 + i * n * 0.038));
    y += n * 0.045 + names.length * n * 0.038 + n * 0.04;
  };
  block("Written by", t.writers.slice(0, 6));
  block("Produced by", t.producers.slice(0, 4));
  g.globalAlpha = 0.55;
  g.font = `400 ${n * 0.022}px ${sans}`;
  g.fillText(`${t.album} · ${t.year}`, n * 0.09, n * 0.93);
  grainOver(g, n, 0.05);
  return c;
}

/**
 * The tray panel under the disc: the album colour, darker, with the shallow round recess the disc
 * sits in pressed into the card (a slightly darker well with a thin lit edge) and the hub's seat.
 */
function drawTray(t: Track, discRadius: number) {
  const n = PANEL;
  const [c, g] = canvas(n);
  const cx = n / 2;
  g.fillStyle = shade(t.color, -0.5);
  g.fillRect(0, 0, n, n);
  const glow = g.createRadialGradient(cx, cx, n * 0.05, cx, cx, n * 0.7);
  glow.addColorStop(0, "rgba(255,255,255,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0.22)");
  g.fillStyle = glow;
  g.fillRect(0, 0, n, n);
  const rr = discRadius * n * 1.03;
  const well = g.createRadialGradient(cx, cx, rr * 0.2, cx, cx, rr);
  well.addColorStop(0, "rgba(0,0,0,0.06)");
  well.addColorStop(0.93, "rgba(0,0,0,0.14)");
  well.addColorStop(1, "rgba(0,0,0,0.28)");
  g.fillStyle = well;
  g.beginPath();
  g.arc(cx, cx, rr, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = n * 0.003;
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.beginPath();
  g.arc(cx, cx + n * 0.001, rr, Math.PI * 0.1, Math.PI * 0.9); // lit lower lip
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.1)";
  g.beginPath();
  g.arc(cx, cx, discRadius * n * 0.16, 0, Math.PI * 2);
  g.stroke();
  grainOver(g, n, 0.05);
  return c;
}

/** The disc print: the front cover filling the disc, with the title and artist set on a line, as on the reference. */
function drawLabel(t: Track, front: CanvasImageSource) {
  const n = ART;
  const [c, g] = canvas(n);
  g.drawImage(front, 0, 0, n, n);
  // ink on metal reads a little darker and flatter than on card
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(0, 0, n, n);
  const sans = font("--sth-sans");
  g.font = `700 ${n * 0.03}px ${sans}`;
  g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = 6;
  g.textAlign = "center";
  const line = `${t.title.toUpperCase()}   ·   ${t.mainArtist.toUpperCase()}`;
  g.fillText(line, n / 2, n * 0.27, n * 0.6);
  return c;
}

/** Everything one album needs. Real images where they exist, drawn ones otherwise. */
export async function buildArt(t: Track): Promise<Art> {
  const fam = font("--sth-display");
  await Promise.all([document.fonts.load(`800 40px ${fam}`), document.fonts.load(`600 20px ${font("--sth-sans")}`), document.fonts.load(`500 20px ${font("--sth-mono")}`)]).catch(() => {});
  const get = (f: ArtFile, on: boolean) => (on ? load(fileUrl(t, f)) : Promise.resolve(null));
  const [fi, bi, ii] = await Promise.all([get("front.webp", t.files.front), get("back.webp", t.files.back), get("inside.webp", t.files.inside)]);
  const front = fi ?? drawFront(t);
  return {
    front: texture(front),
    back: texture(bi ?? drawBack(t)),
    inside: texture(ii ?? drawInside(t)),
    tray: texture(drawTray(t, R / S)),
    label: texture(drawLabel(t, front)),
  };
}

export const disposeArt = (a: Art | null) => a && Object.values(a).forEach((t) => t.dispose());
