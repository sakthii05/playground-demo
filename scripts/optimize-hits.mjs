// Optimises the Top Hits album art for the page: drop images into public/spotify-hits/<slug>/
// named front, back or disc (any of .jpg .jpeg .png .webp .avif .tif, any size), then run
//   npm run optimize:hits
// Each one is cropped to its shape, resized to what the page shows at 2× (see hits-specs.mjs), saved as a
// lossy WebP at quality 80 with metadata stripped, as front.webp / back.webp / disc.webp. The
// original is moved to art-src/<slug>/ (kept out of git), so nothing is lost and public/ only ever
// holds the small files. Images already at their size and under budget are left alone, so it is
// safe to run any time.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { SPECS } from "./hits-specs.mjs";

// work from bytes in memory with no file cache: on Windows a file sharp has opened cannot be moved
sharp.cache(false);

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public", "spotify-hits");
const ORIGINALS = path.join(ROOT, "art-src");
const INPUT = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"];

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function encode(input, { width, height, budget }) {
  const make = (quality) =>
    sharp(input)
      .rotate() // honour the camera's orientation, then drop all metadata
      .resize(width, height, { fit: "cover", position: "centre" })
      .toColourspace("srgb")
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();
  let out = await make(80);
  // busy artwork can run over: one step down in quality is rarely visible
  if (out.length > budget) out = await make(72);
  return out;
}

/** Moves a file into art-src/<slug>/, never overwriting an earlier original. */
function keep(file, slug) {
  const dir = path.join(ORIGINALS, slug);
  fs.mkdirSync(dir, { recursive: true });
  const { name, ext } = path.parse(file);
  let to = path.join(dir, name + ext);
  for (let i = 2; fs.existsSync(to); i++) to = path.join(dir, `${name}-${i}${ext}`);
  try {
    fs.renameSync(file, to);
  } catch {
    // another program has it open (the dev server, an image viewer): copy it, then remove it
    fs.copyFileSync(file, to);
    fs.rmSync(file, { force: true, maxRetries: 5, retryDelay: 200 });
  }
  return path.relative(ROOT, to);
}

const rows = [];
for (const slug of fs.readdirSync(PUBLIC).filter((d) => fs.statSync(path.join(PUBLIC, d)).isDirectory())) {
  const dir = path.join(PUBLIC, slug);
  for (const [name, spec] of Object.entries(SPECS)) {
    const found = fs
      .readdirSync(dir)
      .filter((f) => path.parse(f).name === name && INPUT.includes(path.parse(f).ext.toLowerCase()))
      .map((f) => path.join(dir, f));
    if (!found.length) continue;
    const target = path.join(dir, `${name}.webp`);
    // a new original (not our own .webp) wins; the newest if there are several
    const originals = found.filter((f) => f !== target).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    const source = originals[0] ?? target;
    const input = fs.readFileSync(source); // read once, before the original is moved away
    const before = input.length;
    const meta = await sharp(input).metadata();
    if (source === target && meta.width === spec.width && meta.height === spec.height && before <= spec.budget) {
      rows.push([`${slug}/${name}`, `${meta.width}×${meta.height}, ${kb(before)}`, "already optimised"]);
      continue;
    }
    const out = await encode(input, spec);
    const kept = [source, ...originals.filter((f) => f !== source)].filter((f) => fs.existsSync(f)).map((f) => keep(f, slug));
    fs.writeFileSync(target, out);
    rows.push([`${slug}/${name}`, `${meta.width}×${meta.height}, ${kb(before)}`, `${spec.width}×${spec.height}, ${kb(out.length)}  (original kept in ${kept[0]})`]);
  }
}

if (!rows.length) console.log("No album art found in public/spotify-hits/<slug>/ (front, back or disc).");
else {
  console.log("Top Hits art:");
  for (const [what, from, to] of rows) console.log(`  ${what.padEnd(26)} ${from.padEnd(22)} → ${to}`);
  console.log("\nSwitch on files.front / back / disc in tracks.ts for any new ones, then run npm run check:hits.");
}
