// Checks the Top Hits album folders (public/spotify-hits/<slug>/) against the songs in tracks.ts:
//   - stray files (only the page's own files belong there; anything else would be published)
//   - art that is not at its size or is over budget (run npm run optimize:hits to fix it)
//   - files switched on in `files` but missing, or present but not switched on
//   - audio without a `clip`, a clip that is too long, an audio file that is too heavy
//   - lyrics with no timings, or none that fall inside the clip
// Run with: npm run check:hits   (exits with 1 when there is an error, so it can gate a deploy)
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import sharp from "sharp";
import { SPECS } from "./hits-specs.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIR = path.join(ROOT, "public", "spotify-hits");
const ALLOWED = ["front.webp", "back.webp", "disc.webp", "audio.mp3", "lyrics.lrc", ".gitkeep"];
const FLAG = { "front.webp": "front", "back.webp": "back", "disc.webp": "disc", "audio.mp3": "audio", "lyrics.lrc": "lyrics" };
const MAX_AUDIO = 2.5 * 1024 * 1024;
const MAX_CLIP = 90;

// the songs, straight from tracks.ts (compiled on the fly, so there is one source of truth)
const source = fs.readFileSync(path.join(ROOT, "src/components/spotify-hits/data/tracks.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", js)(mod, mod.exports, () => ({}));
const tracks = mod.exports.TRACKS;

let errors = 0;
let warnings = 0;
const report = [];
const error = (slug, msg) => (errors++, report.push(`  ✗ ${slug}: ${msg}`));
const warn = (slug, msg) => (warnings++, report.push(`  ! ${slug}: ${msg}`));
const kb = (n) => `${Math.round(n / 1024)} KB`;

for (const dir of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (dir.isDirectory() && !tracks.some((t) => t.slug === dir.name)) warn(dir.name, "folder has no song in tracks.ts");
}

for (const t of tracks) {
  const folder = path.join(DIR, t.slug);
  const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  for (const f of files) {
    if (ALLOWED.includes(f)) continue;
    const { name, ext } = path.parse(f);
    if (name in SPECS && /^.(jpe?g|png|avif|tiff?)$/i.test(ext)) error(t.slug, `"${f}" is not optimised yet; run npm run optimize:hits`);
    else error(t.slug, `stray file "${f}" (only ${ALLOWED.slice(0, -1).join(", ")} belong here)`);
  }
  for (const [file, flag] of Object.entries(FLAG)) {
    const there = files.includes(file);
    if (t.files[flag] && !there) error(t.slug, `files.${flag} is on but ${file} is missing`);
    if (!t.files[flag] && there) warn(t.slug, `${file} is there but files.${flag} is off, so it is not used`);
    if (!there) continue;
    const size = fs.statSync(path.join(folder, file)).size;
    if (file.endsWith(".webp")) {
      const spec = SPECS[flag];
      const { width, height } = await sharp(fs.readFileSync(path.join(folder, file))).metadata();
      if (width !== spec.width || height !== spec.height) error(t.slug, `${file} is ${width}×${height}, should be ${spec.width}×${spec.height}; run npm run optimize:hits`);
      else if (size > spec.budget) warn(t.slug, `${file} is ${kb(size)}, over its ${kb(spec.budget)} budget; run npm run optimize:hits`);
    }
    if (file === "audio.mp3" && size > MAX_AUDIO) warn(t.slug, `audio.mp3 is ${kb(size)}; a 60 s clip at 128–160 kbps is about 1 MB`);
  }
  if (t.files.audio) {
    if (!t.clip) error(t.slug, "audio.mp3 is on but there is no clip: { start, end }");
    else if (t.clip.end <= t.clip.start) error(t.slug, `clip ends (${t.clip.end}) before it starts (${t.clip.start})`);
    else if (t.clip.end - t.clip.start > MAX_CLIP) warn(t.slug, `clip is ${t.clip.end - t.clip.start} s; keep it to ${MAX_CLIP} s or less`);
  }
  if (t.files.lyrics && files.includes("lyrics.lrc")) {
    const text = fs.readFileSync(path.join(folder, "lyrics.lrc"), "utf8");
    const offset = Number(/\[offset:\s*([+-]?\d+)\s*\]/i.exec(text)?.[1] ?? 0) / 1000;
    const times = [...text.matchAll(/\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g)].map((m) => Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 10 ** (m[3]?.length ?? 1));
    if (!times.length) error(t.slug, "lyrics.lrc has no [mm:ss.xx] timings");
    else if (t.clip) {
      const inside = times.filter((s) => s - offset >= t.clip.start && s - offset < t.clip.end).length;
      if (!inside) error(t.slug, `none of the ${times.length} lyric lines fall inside the clip (${t.clip.start}–${t.clip.end} s); check the clip or the file's timing`);
    }
  }
}

console.log(`Top Hits assets: ${tracks.length} songs checked`);
if (report.length) console.log(report.join("\n"));
console.log(errors || warnings ? `${errors} error(s), ${warnings} warning(s)` : "  ✓ all good");
process.exit(errors ? 1 : 0);
