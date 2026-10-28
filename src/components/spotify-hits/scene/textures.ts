// Textures. The front cover, back insert and disc label come from public/spotify-hits/<slug>/ when
// the file exists, and are drawn on a canvas from the track's data otherwise. The booklet's inside
// page and the tray side of the insert are always drawn: the album's colour as paper, with the song
// details printed into it. Surface detail (paper grain, the print's dot screen, the disc's data side,
// wear on the plastic) is generated here too, so none of it is a download.
import * as THREE from "three";
import { fileUrl, formatTime, type ArtFile, type Track } from "../data/tracks";
import { PAPER, R } from "./live";

// drawn art size for the square pieces (front cover, booklet page, disc label)
const ART = 1024;

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

/** A 1 px white image: stands in for art that has not arrived, so materials keep one shader throughout. */
export const BLANK = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
})();

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

/** A small seeded random, so each album's marks are its own but the same on every visit. */
export function seeded(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Handling wear on one album's clear plastic, as roughness. Almost all of it is smooth; a case that
 * has been handled has only a few marks: some faint hairlines, a couple of soft swirls from a cloth,
 * a little dust, each case different. They only show where a reflection crosses them.
 */
export function plasticWear(seed: number) {
  const rnd = seeded(seed);
  const N = 512;
  const [c, g] = canvas(N);
  g.fillStyle = "rgb(20,20,20)";
  g.fillRect(0, 0, N, N);
  g.lineCap = "round";
  const marks = 10 + Math.floor(rnd() * 16);
  for (let i = 0; i < marks; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const v = 30 + rnd() * 22;
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.globalAlpha = 0.3 + rnd() * 0.5;
    g.lineWidth = 0.5 + rnd() * 0.6;
    g.beginPath();
    if (rnd() < 0.3) {
      // a cloth swirl: a short arc
      const r = 20 + rnd() * 90;
      const a = rnd() * Math.PI * 2;
      g.arc(x, y, r, a, a + 0.3 + rnd() * 0.7);
    } else {
      const a = rnd() * Math.PI;
      const l = 6 + Math.pow(rnd(), 2) * 70;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  const dust = 30 + Math.floor(rnd() * 50);
  for (let i = 0; i < dust; i++) {
    const v = 40 + rnd() * 40;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(rnd() * N, rnd() * N, 1, 1);
  }
  const t = texture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- album art ----------

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

const fontsReady = () =>
  Promise.all([document.fonts.load(`800 40px ${font("--sth-display")}`), document.fonts.load(`600 20px ${font("--sth-sans")}`), document.fonts.load(`500 20px ${font("--sth-mono")}`)]).catch(() => {});

const light = (hex: string) => {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 > 0.62;
};
const ink = (hex: string) => (light(hex) ? "#111111" : "#ffffff");
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

// Paper and grain come from small tiles made once and laid over the page as patterns (each at its own
// offset, so no two pages line up): a few milliseconds a page, instead of tens for drawing every
// fibre and touching every pixel, so the work fits between frames.
let tiles: { noise: HTMLCanvasElement; fibres: HTMLCanvasElement; clouds: HTMLCanvasElement } | null = null;
function paperTiles() {
  if (tiles) return tiles;
  const [noise, gn] = canvas(256);
  const img = gn.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 128;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  gn.putImageData(img, 0, 0);
  const [fibres, gf] = canvas(512);
  gf.lineWidth = 0.8;
  for (let i = 0; i < 360; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const a = Math.random() * Math.PI * 2;
    const l = 3 + Math.random() * 10;
    gf.strokeStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    gf.beginPath();
    gf.moveTo(x, y);
    gf.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    gf.stroke();
  }
  const [clouds, gc] = canvas(512);
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 30 + Math.random() * 90;
    // drawn wrapped, so the tile repeats without a seam
    for (const [ox, oy] of [[0, 0], [-512, 0], [512, 0], [0, -512], [0, 512]]) {
      const c = gc.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      c.addColorStop(0, i % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.045)");
      c.addColorStop(1, "rgba(0,0,0,0)");
      gc.fillStyle = c;
      gc.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  return (tiles = { noise, fibres, clouds });
}

function lay(g: CanvasRenderingContext2D, tile: HTMLCanvasElement, w: number, h: number, scale = 1) {
  const p = g.createPattern(tile, "repeat")!;
  p.setTransform(new DOMMatrix().translateSelf(Math.random() * tile.width, Math.random() * tile.height).scaleSelf(scale));
  g.fillStyle = p;
  g.fillRect(0, 0, w, h);
}

/** Fine grain over the whole page, ink and all, as print on real stock has. */
function grainOver(g: CanvasRenderingContext2D, w: number, h: number, alpha: number) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = Math.min(1, alpha * 4);
  lay(g, paperTiles().noise, w, h);
  g.restore();
}

/**
 * Uncoated stock in the album's colour: the base tone, soft clouding where the fibres bunch, and
 * short fibres catching the light. Printing goes on top with `inked`, and `grainOver` last, so the
 * grain runs through the type as it does through ink on real paper.
 */
function paper(g: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const t = paperTiles();
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  lay(g, t.clouds, w, h, 1.6);
  lay(g, t.fibres, w, h);
}

/**
 * Sets up printing on paper of `color`: dark ink multiplies into light stock; on dark stock the
 * ink is a warm off-white, not pure white. A hair of blur is the ink spreading into the fibres.
 */
function inked(g: CanvasRenderingContext2D, color: string, alpha = 0.9) {
  const onLight = light(color);
  g.globalCompositeOperation = onLight ? "multiply" : "source-over";
  g.fillStyle = g.strokeStyle = onLight ? shade(color, -0.78) : "#f3eee4";
  g.globalAlpha = alpha;
  g.shadowColor = g.fillStyle as string;
  g.shadowBlur = 0.8;
}
const plain = (g: CanvasRenderingContext2D) => {
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.shadowBlur = 0;
};

/**
 * A canvas the shape of a face (w × h px) whose printing is laid out by `draw` in a frame of fw × fh.
 * Upright, the frame is turned a quarter (fw = h, fh = w), for a face seen turned upright: the open
 * case on tall screens, so the page still reads. The paper grain goes over last, through the type.
 */
function face(w: number, h: number, upright: boolean, grain: number, draw: (g: CanvasRenderingContext2D, fw: number, fh: number) => void) {
  const [c, g] = canvas(w, h);
  if (upright) {
    g.translate(0, h);
    g.rotate(-Math.PI / 2);
    draw(g, h, w);
  } else draw(g, w, h);
  g.setTransform(1, 0, 0, 1, 0, 0);
  plain(g);
  grainOver(g, w, h, grain);
  return c;
}

/** Pixel size for a face of `wMm` × `hMm`, `long` px along its longer side. */
const px = (wMm: number, hMm: number, long: number) => (wMm >= hMm ? [long, Math.round((long * hMm) / wMm)] : [Math.round((long * wMm) / hMm), long]);

/**
 * A stand-in front cover, drawn at the booklet's shape. Each album gets its own motif (a ring, bands,
 * its rank as an outline numeral, or a rising sun), placed by its own seed, so no two look alike.
 */
function drawFront(t: Track) {
  const [w, h] = px(PAPER.bookW, PAPER.bookH, ART);
  const [c, g] = canvas(w, h);
  const rnd = seeded(t.rank * 31 + 7);
  const fg = ink(t.color);
  const soft = fg === "#ffffff" ? "rgba(255,255,255," : "rgba(0,0,0,";
  const display = font("--sth-display");
  const sans = font("--sth-sans");
  const mono = font("--sth-mono");
  const u = Math.min(w, h);
  g.fillStyle = t.color;
  g.fillRect(0, 0, w, h);
  const gx = w * (0.15 + rnd() * 0.7);
  const gy = h * (0.1 + rnd() * 0.4);
  const glow = g.createRadialGradient(gx, gy, 0, gx, gy, u * 1.2);
  glow.addColorStop(0, "rgba(255,255,255,0.2)");
  glow.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  const motif = t.rank % 4;
  if (motif === 0) {
    g.strokeStyle = `${soft}0.15)`;
    g.lineWidth = u * (0.05 + rnd() * 0.06);
    g.beginPath();
    g.arc(w * (0.45 + rnd() * 0.4), h * (0.2 + rnd() * 0.3), u * (0.2 + rnd() * 0.2), 0, Math.PI * 2);
    g.stroke();
  } else if (motif === 1) {
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(-0.5 + rnd() * 1);
    g.fillStyle = `${soft}0.09)`;
    for (let i = -6; i < 6; i++) g.fillRect(-w, i * u * 0.16, w * 2, u * (0.03 + rnd() * 0.05));
    g.restore();
  } else if (motif === 2) {
    g.strokeStyle = `${soft}0.2)`;
    g.lineWidth = u * 0.006;
    g.font = `800 ${u * 0.85}px ${display}`;
    g.textAlign = "right";
    g.strokeText(String(t.rank).padStart(2, "0"), w * 1.02, h * 0.72);
    g.textAlign = "left";
  } else {
    const sx = w * (0.3 + rnd() * 0.4);
    for (let i = 5; i > 0; i--) {
      g.fillStyle = `${soft}${0.035 * (6 - i)})`;
      g.beginPath();
      g.arc(sx, h * 0.62, u * 0.09 * i, Math.PI, 0);
      g.fill();
    }
  }
  g.fillStyle = fg;
  g.font = `600 ${u * 0.03}px ${sans}`;
  g.fillText(t.mainArtist.toUpperCase(), w * 0.07, h * 0.1);
  g.font = `500 ${u * 0.026}px ${mono}`;
  g.textAlign = "right";
  g.fillText(`No. ${String(t.rank).padStart(2, "0")}`, w * 0.93, h * 0.1);
  g.textAlign = "left";
  const title = t.title.toUpperCase();
  const size = fit(g, title, display, 800, w * 0.86, u * 0.2);
  g.font = `800 ${size}px ${display}`;
  const rows = lines(g, title, w * 0.86);
  rows.forEach((row, i) => g.fillText(row, w * 0.07, h * 0.92 - (rows.length - 1 - i) * size * 0.9));
  grainOver(g, w, h, 0.06);
  return c;
}

/**
 * The booklet's inside page, seen when the case opens: printed on the album's colour like the
 * reference's tracklist page. The track with a dotted leader to its length, the credits in two
 * columns, and the title set big at the foot.
 */
function drawInside(t: Track, upright: boolean) {
  const [w, h] = px(PAPER.bookW, PAPER.bookH, ART);
  const stock = shade(t.color, -0.12);
  const display = font("--sth-display");
  const sans = font("--sth-sans");
  const mono = font("--sth-mono");
  return face(w, h, upright, 0.045, (g, fw, fh) => {
    const u = Math.min(fw, fh);
    paper(g, fw, fh, stock);
    const m = u * 0.08;
    inked(g, stock, 0.7);
    g.font = `600 ${u * 0.019}px ${sans}`;
    g.fillText(`NO. ${String(t.rank).padStart(2, "0")}  ·  SPOTIFY ALL-TIME TOP 10`, m, m);
    g.textAlign = "right";
    g.fillText(String(t.year), fw - m, m);
    g.textAlign = "left";
    // the track, with a dotted leader to its length
    inked(g, stock, 0.92);
    const y0 = m + u * 0.09;
    g.font = `500 ${u * 0.026}px ${mono}`;
    g.fillText("01", m, y0);
    g.font = `600 ${u * 0.032}px ${sans}`;
    g.fillText(t.title, m + u * 0.06, y0);
    const tw = g.measureText(t.title).width;
    g.font = `500 ${u * 0.026}px ${mono}`;
    g.textAlign = "right";
    g.fillText(formatTime(t.durationMs), fw - m, y0);
    g.textAlign = "left";
    g.globalAlpha = 0.45;
    for (let x = m + u * 0.06 + tw + u * 0.02; x < fw - m - u * 0.09; x += u * 0.012) g.fillRect(x, y0 - 3, 2.5, 2.5);
    // credits, two columns
    const col = (label: string, names: string[], x: number, y: number) => {
      inked(g, stock, 0.6);
      g.font = `700 ${u * 0.017}px ${sans}`;
      g.fillText(label.toUpperCase(), x, y);
      inked(g, stock, 0.9);
      g.font = `500 ${u * 0.024}px ${sans}`;
      names.forEach((name, i) => g.fillText(name, x, y + u * 0.04 + i * u * 0.034));
    };
    const yc = y0 + u * 0.1;
    col("Written by", t.writers.slice(0, 7), m, yc);
    col("Produced by", t.producers.slice(0, 5), fw * 0.54, yc);
    inked(g, stock, 0.55);
    g.font = `400 ${u * 0.02}px ${sans}`;
    g.fillText(`${t.album}  ·  ${t.mainArtist}`, m, yc + u * 0.33);
    // the title, big, at the foot
    inked(g, stock, 0.95);
    const big = t.title.toUpperCase();
    const size = fit(g, big, display, 800, fw - 2 * m, u * 0.15, 2);
    g.font = `800 ${size}px ${display}`;
    const rows = lines(g, big, fw - 2 * m);
    rows.forEach((row, i) => g.fillText(row, m - size * 0.04, fh - m - (rows.length - 1 - i) * size * 0.88));
  });
}

/**
 * The front of the back insert, seen round the disc through the clear tray. The disc covers the
 * middle, so the printing sits in the corners: artist and rank at the top, title and year below.
 */
function drawTray(t: Track, upright: boolean) {
  const [w, h] = px(PAPER.inlayW, PAPER.inlayH, 1104);
  const stock = shade(t.color, -0.32);
  const sans = font("--sth-sans");
  const mono = font("--sth-mono");
  const display = font("--sth-display");
  const disc = (2 * R) / Math.max(PAPER.inlayW, PAPER.inlayH);
  return face(w, h, upright, 0.045, (g, fw, fh) => {
    const u = Math.max(fw, fh);
    paper(g, fw, fh, stock);
    // a faint printed ring where the disc sits, as some inserts carry
    inked(g, stock, 0.12);
    g.lineWidth = u * 0.004;
    g.beginPath();
    g.arc(fw / 2, fh / 2, (disc * u) / 2 + u * 0.012, 0, Math.PI * 2);
    g.stroke();
    const m = u * 0.035;
    inked(g, stock, 0.75);
    g.font = `700 ${u * 0.017}px ${sans}`;
    g.fillText(t.mainArtist.toUpperCase(), m, m + u * 0.012);
    g.textAlign = "right";
    g.font = `500 ${u * 0.016}px ${mono}`;
    g.fillText(`No. ${String(t.rank).padStart(2, "0")}`, fw - m, m + u * 0.012);
    g.textAlign = "left";
    inked(g, stock, 0.9);
    g.font = `800 ${u * 0.03}px ${display}`;
    g.fillText(t.title.toUpperCase(), m, fh - m, fw * 0.4);
    inked(g, stock, 0.6);
    g.textAlign = "right";
    g.font = `400 ${u * 0.015}px ${mono}`;
    g.fillText(`℗ ${t.year}  ·  ${formatTime(t.durationMs)}`, fw - m, fh - m);
  });
}


/**
 * The whole back insert as printed flat (spine | back | spine), used when there is no back.webp:
 * the track and credits on the back panel, a barcode, and the title and artist up each spine.
 */
function drawBack(t: Track, spineShare: number) {
  const w = 1200;
  const h = Math.round(w * (118 / 150));
  const [c, g] = canvas(w, h);
  const stock = shade(t.color, -0.22);
  const sans = font("--sth-sans");
  const mono = font("--sth-mono");
  const display = font("--sth-display");
  paper(g, w, h, stock);
  const sp = spineShare * w;
  // spines: a shade darker, with the title and artist reading up them
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(0, 0, sp, h);
  g.fillRect(w - sp, 0, sp, h);
  for (const x of [sp / 2, w - sp / 2]) {
    g.save();
    g.translate(x, h / 2);
    g.rotate(-Math.PI / 2);
    inked(g, stock, 0.9);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 ${sp * 0.42}px ${sans}`;
    g.fillText(`${t.mainArtist.toUpperCase()}   ${t.title.toUpperCase()}`, 0, 0, h * 0.9);
    g.restore();
  }
  plain(g);
  const x0 = sp + w * 0.05;
  const x1 = w - sp - w * 0.05;
  inked(g, stock, 0.92);
  g.font = `800 ${w * 0.05}px ${display}`;
  g.fillText(t.title.toUpperCase(), x0, h * 0.16);
  g.font = `600 ${w * 0.02}px ${sans}`;
  g.fillText(t.mainArtist, x0, h * 0.22);
  inked(g, stock, 0.85);
  g.font = `500 ${w * 0.017}px ${mono}`;
  g.fillText("01", x0, h * 0.34);
  g.font = `500 ${w * 0.019}px ${sans}`;
  g.fillText(t.title, x0 + w * 0.04, h * 0.34);
  g.textAlign = "right";
  g.font = `500 ${w * 0.017}px ${mono}`;
  g.fillText(formatTime(t.durationMs), x1, h * 0.34);
  g.textAlign = "left";
  inked(g, stock, 0.6);
  g.font = `400 ${w * 0.014}px ${sans}`;
  [`Written by ${t.writers.join(", ")}`, `Produced by ${t.producers.join(", ")}`, `${t.album} · ${t.year}`].forEach((s, i) => {
    lines(g, s, x1 - x0).forEach((row, j) => g.fillText(row, x0, h * 0.45 + i * h * 0.07 + j * h * 0.03));
  });
  plain(g);
  // barcode on a white patch
  const bx = x0;
  const by = h * 0.74;
  g.fillStyle = "#f4f1ea";
  g.fillRect(bx, by, w * 0.2, h * 0.15);
  g.fillStyle = "#111";
  let x = bx + w * 0.012;
  let seed = t.rank * 97;
  while (x < bx + w * 0.188) {
    seed = (seed * 9301 + 49297) % 233280;
    const bw = 1 + (seed % 4) * 1.4;
    g.fillRect(x, by + h * 0.015, bw, h * 0.1);
    x += bw + 2 + (seed % 3);
  }
  inked(g, stock, 0.6);
  g.textAlign = "right";
  g.font = `400 ${w * 0.013}px ${mono}`;
  g.fillText(`℗ ${t.year} ${t.mainArtist}  ·  Made for Spotify Top Hits`, x1, h * 0.88);
  plain(g);
  grainOver(g, w, h, 0.045);
  return c;
}

/** The disc print when there is no disc.webp: the middle square of the front cover filling the disc, with the title and artist set on a line. */
function drawLabel(t: Track, front: HTMLImageElement | HTMLCanvasElement) {
  const n = ART;
  const [c, g] = canvas(n);
  const fw = front.width;
  const fh = front.height;
  const side = Math.min(fw, fh);
  g.drawImage(front, (fw - side) / 2, (fh - side) / 2, side, side, 0, 0, n, n);
  // ink on metal reads a little darker and flatter than on card
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(0, 0, n, n);
  const sans = font("--sth-sans");
  g.font = `700 ${n * 0.03}px ${sans}`;
  g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,0.35)";
  g.shadowBlur = 6;
  g.textAlign = "center";
  g.fillText(`${t.title.toUpperCase()}   ·   ${t.mainArtist.toUpperCase()}`, n / 2, n * 0.27, n * 0.6);
  return c;
}

const get = (t: Track, f: ArtFile, on: boolean) => (on ? load(fileUrl(t, f)) : Promise.resolve(null));

/** Each album's front cover, loaded or drawn once and shared by the 3D booklet and the page backdrop. */
const fronts = new Map<string, Promise<HTMLImageElement | HTMLCanvasElement>>();
function frontSource(t: Track) {
  let p = fronts.get(t.slug);
  if (!p) {
    // drawn covers are made one per quiet moment, so the intro's ball never waits on them
    p = fontsReady().then(async () => {
      const img = await get(t, "front.webp", t.files.front);
      if (img) return img;
      await idle();
      return drawFront(t);
    });
    fronts.set(t.slug, p);
  }
  return p;
}

const backdrops = new Map<string, Promise<string>>();
/** A small image of the front cover for the page behind the open album (blurred there, so it can be small). */
export function frontBackdrop(t: Track) {
  let p = backdrops.get(t.slug);
  if (!p) {
    p = frontSource(t).then((src) => {
      const [c, g] = canvas(512, Math.round((512 * src.height) / src.width));
      g.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.8);
    });
    backdrops.set(t.slug, p);
  }
  return p;
}

/** What every album needs, even in the carousel: its front cover (the image, or one drawn). */
export interface FrontArt {
  front: THREE.Texture;
  source: HTMLImageElement | HTMLCanvasElement;
}
export async function buildFront(t: Track): Promise<FrontArt> {
  const source = await frontSource(t);
  const front = texture(source);
  // the booklet is a little wider than tall; a square image fills it across and loses a sliver top and bottom
  const want = PAPER.bookH / PAPER.bookW;
  const have = source.height / source.width;
  if (have > want) {
    front.repeat.y = want / have;
    front.offset.y = (1 - front.repeat.y) / 2;
  } else if (have < want) {
    front.repeat.x = have / want;
    front.offset.x = (1 - front.repeat.x) / 2;
  }
  return { front, source };
}

/**
 * What only the open album needs: the booklet's inside page and the tray side of the insert (always
 * drawn, laid out for the screen's orientation: as they lie, or turned for the upright open case on
 * tall screens), the back insert (the image, or drawn) with its back panel cut from it, and the disc
 * label. Made ahead of time (see `detailArt`), never while it is needed.
 */
export interface DetailArt {
  inside: THREE.Texture;
  tray: THREE.Texture;
  /** The whole insert, spine | back | spine, for the spines. */
  insert: THREE.Texture;
  /** Just the back panel of it, for the back face. */
  back: THREE.Texture;
  label: THREE.Texture;
}

/** Waits for a quiet moment between frames; each piece of drawing below fits in one. */
const idle = () =>
  new Promise<void>((done) => (typeof requestIdleCallback === "function" ? requestIdleCallback(() => done(), { timeout: 250 }) : setTimeout(done, 16)));

async function buildDetail(t: Track, upright: boolean): Promise<DetailArt> {
  const [front] = await Promise.all([frontSource(t), fontsReady()]);
  const [bi, di] = await Promise.all([get(t, "back.webp", t.files.back), get(t, "disc.webp", t.files.disc)]);
  const total = PAPER.inlayW + 2 * PAPER.spine;
  await idle();
  const insert = texture(bi ?? drawBack(t, PAPER.spine / total));
  const back = insert.clone();
  back.repeat.x = PAPER.inlayW / total;
  back.offset.x = PAPER.spine / total;
  back.needsUpdate = true;
  await idle();
  const inside = texture(drawInside(t, upright));
  await idle();
  const tray = texture(drawTray(t, upright));
  await idle();
  const label = texture(di ?? drawLabel(t, front));
  return { inside, tray, insert, back, label };
}

/**
 * Detail art by album and orientation, made once and cached. The page asks for the chosen album's
 * and, ahead of time, its neighbours', so next and previous never wait; the least recently used
 * beyond `KEEP` are freed.
 */
const details = new Map<string, Promise<DetailArt>>();
const KEEP = 6;
export function detailArt(t: Track, upright: boolean) {
  const key = `${t.slug}|${upright ? "up" : "flat"}`;
  const hit = details.get(key);
  if (hit) {
    details.delete(key);
    details.set(key, hit);
    return hit;
  }
  const made = buildDetail(t, upright);
  details.set(key, made);
  while (details.size > KEEP) {
    const [oldest, old] = details.entries().next().value!;
    details.delete(oldest);
    old.then(disposeArt);
  }
  return made;
}

/** True once the GPU has the texture (so waiting a frame for it would be wasted). */
export const uploaded = (gl: THREE.WebGLRenderer, t: THREE.Texture) => !!(gl.properties.get(t) as { __webglInit?: boolean }).__webglInit;

/**
 * One queue for every texture the page sends to the GPU: at most one a frame, however many albums
 * have art ready at the same moment, so uploads never pile into a single slow frame.
 */
let uploads: Promise<void> = Promise.resolve();
export function queueUpload(gl: THREE.WebGLRenderer, tex: THREE.Texture) {
  const done = uploads.then(async () => {
    if (uploaded(gl, tex)) return;
    gl.initTexture(tex);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
  uploads = done.catch(() => {});
  return done;
}

/** Sends an album's detail art to the GPU through the queue, skipping what is already there. */
export async function upload(gl: THREE.WebGLRenderer, art: DetailArt, alive: () => boolean = () => true) {
  for (const tex of Object.values(art)) {
    if (!alive()) return false;
    await queueUpload(gl, tex);
  }
  return alive();
}

export const disposeArt = (a: FrontArt | DetailArt | null) =>
  a && Object.values(a).forEach((t) => t instanceof THREE.Texture && t.dispose());
