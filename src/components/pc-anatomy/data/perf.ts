// Compatibility rules and the workload model. Gaming FPS, power, temperatures and fan speeds are anchored
// on measured review data (catalog.ts). What is modelled on top — CPU scaling for a given card, preset and
// upscaling factors, utilisation — is listed under `estimated` so the page says so.
import { BOARDS, CPUS, GAMES, GPUS, type Board, type Cpu, type Gpu, type Res } from "./catalog";

export const gpuById = (id: string) => GPUS.find((g) => g.id === id) ?? null;
export const cpuById = (id: string) => CPUS.find((c) => c.id === id) ?? null;
export const boardById = (id: string) => BOARDS.find((b) => b.id === id) ?? null;
export const gameById = (id: string) => GAMES.find((g) => g.id === id) ?? null;

// ---------- compatibility ----------
export type Match = "balanced" | "good" | "cpu-limited";
const RTX4090_AVG = { "1080p": 215.4, "1440p": 172.4, "4k": 105.7 };
/** How well a CPU keeps up with a GPU in games: CPUs all fit any GPU, so this is balance, not a hard rule.
 * Same test the game numbers use: the CPU's gap to the fastest gaming CPU, scaled by how fast the card is. */
export function pairing(gpu: Gpu, cpu: Cpu): { match: Match; note: string } {
  const pull = (res: "1080p" | "1440p", idx: number) => (1 - idx) * Math.min(1.4, Math.max(0.4, gpu.avg[res] / RTX4090_AVG[res]));
  const p1080 = pull("1080p", cpu.gaming);
  const p1440 = pull("1440p", cpu.gaming1440);
  if (p1440 > 0.07) return { match: "cpu-limited", note: "Holds the card back at 1080p and 1440p" };
  if (p1080 > 0.07) return { match: "good", note: "Loses a little at 1080p, full speed at 1440p and 4K" };
  return { match: "balanced", note: "Keeps up at every resolution" };
}
/** Boards that fit the CPU's socket, best first for high-end CPUs. */
export function boardsFor(cpu: Cpu): (Board & { recommended: boolean; reason: string })[] {
  const highEnd = cpu.apps >= 1.1 || cpu.gaming >= 0.99;
  return BOARDS.filter((b) => b.socket === cpu.socket)
    .map((b) => ({ ...b, recommended: highEnd ? b.tier === "best" : b.tier === "value", reason: b.tier === "best" ? (highEnd ? "Full power delivery and PCIe 5.0 for this CPU" : "More than this CPU needs") : highEnd ? "Works, but limits overclocking and M.2" : "Everything this CPU needs, for less" }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended));
}
export const psuFor = (gpu: Gpu) => Math.max(850, gpu.psu);

// ---------- workloads ----------
export type Preset = "ultra" | "high" | "medium";
export type Workload =
  | { kind: "game"; game: string; res: Res; preset: Preset; upscale: boolean; framegen: boolean }
  | { kind: "browse"; tabs: number; video: boolean }
  | { kind: "create"; app: "render" | "export" };

export interface Profile {
  label: string;
  fps: number | null;
  low1: number | null;
  frameMs: number | null;
  cpuUtil: number; // %
  gpuUtil: number; // %
  encoder: number; // % of the video engine
  ramGB: number;
  vramGB: number;
  cpuW: number;
  gpuW: number;
  wallW: number;
  cpuC: number;
  gpuC: number;
  gpuFan: number; // rpm, 0 = fans stopped
  busyThreads: number;
  limitedBy: "gpu" | "cpu" | "none";
  why: string; // one line for the badge
  measured: string[];
  estimated: string[];
  minutes?: number; // render/export jobs
}

const RTX4090 = RTX4090_AVG;
const DOWN: Record<Res, Res | null> = { "4k": "1440p", "1440p": "1080p", "1080p": null };
const VRAM: Record<Res, number> = { "1080p": 7.0, "1440p": 8.4, "4k": 10.8 };
const PRESET: Record<Preset, number> = { ultra: 1, high: 1.18, medium: 1.38 };
const EFF = 0.9; // 80 PLUS Gold at typical load

/** TechPowerUp's CPU gaming index at a resolution (9800X3D = 1). 4K is not charted: estimated from 1440p. */
const cpuIndex = (cpu: Cpu, res: Res) => (res === "1080p" ? cpu.gaming : res === "1440p" ? cpu.gaming1440 : 1 - (1 - cpu.gaming1440) * 0.35);
/** Wall power from the measured idle system plus what the parts draw on top of their idle. */
const wall = (cpu: Cpu, gpu: Gpu, cpuW: number, gpuW: number) => {
  const cpuIdle = cpu.brand === "AMD" ? 22 : 6;
  return cpu.idleSysW - 18 + Math.max(0, cpuW - cpuIdle) / EFF + gpuW / EFF;
};
/** Temperatures and fan speed scale from the measured gaming point by power drawn. */
const gpuThermal = (gpu: Gpu, w: number) => {
  const k = Math.max(0, Math.min(1.1, w / gpu.gamingW));
  const gpuC = 34 + (gpu.gameC - 34) * k;
  return { gpuC, gpuFan: gpuC < 50 ? 0 : Math.round(gpu.fanRpm * Math.min(1.1, 0.35 + 0.65 * k)) };
};
const cpuThermal = (cpu: Cpu, w: number) => {
  // measured with a Noctua NH-D15; the 360 mm AIO here runs a few degrees cooler under sustained load
  const ref = w > cpu.gamingW * 1.3 ? { w: cpu.loadW, c: cpu.loadC - 3 } : { w: cpu.gamingW, c: cpu.gameC - 2 };
  return 30 + (ref.c - 30) * Math.max(0, Math.min(1.1, w / ref.w));
};

function gaming(gpu: Gpu, cpu: Cpu, w: Extract<Workload, { kind: "game" }>): Profile {
  const g = gameById(w.game) ?? GAMES[0];
  const measured: string[] = [];
  const estimated: string[] = [];
  const isMeasured = (res: Res) => g.measured[res].includes(gpu.id);
  const cite = (res: Res) => {
    const v = g.fps[res][gpu.id];
    if (isMeasured(res)) measured.push(`${g.name} · ${res === "4k" ? "4K" : res} · ${g.settings}: ${v} FPS on ${gpu.name} with a Ryzen 7 9800X3D (${g.source})`);
    else estimated.push(`${g.name} · ${res === "4k" ? "4K" : res}: ${v} FPS on ${gpu.name}, scaled from a measured card by ${g.source}/TechPowerUp averages`);
    return v;
  };
  // the resolution the GPU actually renders: Quality upscaling renders at about two thirds
  const render = w.upscale ? DOWN[w.res] : w.res;
  let fps: number;
  if (w.upscale && render) {
    fps = cite(render) * 0.93;
    estimated.push(`${gpu.brand === "AMD" ? "FSR 4" : "DLSS 4"} Quality: rendered at ${render === "4k" ? "4K" : render} (measured), less 7% for the upscaler`);
  } else {
    fps = cite(w.res) * (w.upscale ? 1.2 : 1);
    if (w.upscale) estimated.push("Upscaling at 1080p: +20%");
  }
  if (w.preset !== "ultra") {
    fps *= PRESET[w.preset];
    estimated.push(`${w.preset === "high" ? "High" : "Medium"} preset: +${Math.round((PRESET[w.preset] - 1) * 100)}% over the tested settings`);
  }
  // CPU scaling. The review numbers use the fastest gaming CPU; TechPowerUp's CPU index was measured with an
  // RTX 4090, so the gap is scaled by how fast this card is against a 4090, and by how CPU-heavy the game is.
  const rr = render ?? w.res;
  const gap = 1 - cpuIndex(cpu, rr);
  const loss = Math.min(0.45, gap * Math.min(1.4, Math.max(0.4, gpu.avg[rr] / RTX4090[rr])) * g.cpuWeight);
  fps *= 1 - loss;
  if (cpu.id !== "r7-9800x3d") estimated.push(`${cpu.name}: −${(loss * 100).toFixed(1)}% here, from TechPowerUp's CPU gaming index at ${rr === "4k" ? "4K" : rr}`);
  const ratio = g.low?.[w.res]?.[gpu.id] ? g.low[w.res][gpu.id] / g.fps[w.res][gpu.id] : gpu.lowRatio;
  let low1 = fps * ratio * (1 - loss * 0.4);
  if (w.framegen) {
    fps *= 1.75;
    low1 *= 1.6;
    estimated.push("Frame generation (2×): +75% frames shown; input latency stays at the rendered rate");
  }
  const gpuUtil = Math.max(50, Math.min(99, 98 * (1 - loss * 1.3)));
  const busyThreads = Math.min(cpu.threads, (6 + 4 * g.cpuWeight) * (w.framegen ? 1 : 1));
  const cpuUtil = Math.min(100, (busyThreads / cpu.threads) * (55 + 25 * Math.min(1, fps / 240)) + 4);
  const gpuW = gpu.gamingW * (gpuUtil / 97) * (w.preset === "medium" ? 0.9 : w.preset === "high" ? 0.96 : 1);
  const cpuW = Math.min(cpu.maxPower, cpu.gamingW * (0.75 + 0.25 * Math.min(2, fps / 150)) * Math.sqrt(g.cpuWeight));
  const { gpuC, gpuFan } = gpuThermal(gpu, gpuW);
  measured.push(`${gpu.name}: ${gpu.gamingW} W gaming, ${gpu.gameC} °C, ${gpu.fanRpm} rpm (TechPowerUp, ${gpu.tested})`);
  measured.push(`${cpu.name}: ${cpu.gamingW} W in games, ${cpu.gameC} °C on an NH-D15 (TechPowerUp)`);
  estimated.push("Utilisation, memory use and how power follows load: modelled");
  const cpuBound = loss > 0.07;
  return {
    label: `${g.name} · ${w.res === "4k" ? "4K" : w.res}`,
    fps,
    low1,
    frameMs: 1000 / fps,
    cpuUtil,
    gpuUtil,
    encoder: 0,
    ramGB: 13.5 + (w.res === "4k" ? 1.2 : 0),
    vramGB: Math.min(gpu.vram - 0.4, VRAM[rr] * (g.cpuWeight > 1.4 ? 0.55 : 1) + (w.framegen ? 0.6 : 0)),
    cpuW,
    gpuW,
    wallW: wall(cpu, gpu, cpuW, gpuW),
    cpuC: cpuThermal(cpu, cpuW),
    gpuC,
    gpuFan,
    busyThreads,
    limitedBy: cpuBound ? "cpu" : "gpu",
    why: cpuBound ? `The CPU sets the pace — the GPU waits at ${Math.round(gpuUtil)}%` : `The graphics card sets the pace at ${Math.round(gpuUtil)}%`,
    measured,
    estimated,
  };
}

export function profile(gpu: Gpu, cpu: Cpu, w: Workload): Profile {
  if (w.kind === "game") return gaming(gpu, cpu, w);
  if (w.kind === "browse") {
    const cpuUtil = Math.min(45, 2 + w.tabs * 0.35 + (w.video ? 3 : 0));
    const cpuW = (cpu.brand === "AMD" ? 24 : 9) + cpuUtil * 0.55;
    const gpuW = w.video ? gpu.videoW : gpu.idleW + 2;
    const { gpuC, gpuFan } = gpuThermal(gpu, gpuW);
    return {
      label: `${w.tabs} browser tabs${w.video ? " · 4K video" : ""}`,
      fps: null,
      low1: null,
      frameMs: null,
      cpuUtil,
      gpuUtil: (w.video ? 9 : 2) + w.tabs * 0.08,
      encoder: 0,
      ramGB: Math.min(60, 3.8 + w.tabs * 0.3 + (w.video ? 0.6 : 0)),
      vramGB: 0.8 + w.tabs * 0.025 + (w.video ? 0.4 : 0),
      cpuW,
      gpuW,
      wallW: wall(cpu, gpu, cpuW, gpuW),
      cpuC: 32 + cpuUtil * 0.35,
      gpuC,
      gpuFan,
      busyThreads: Math.min(cpu.threads, 2 + w.tabs / 8),
      limitedBy: "none",
      why: w.video ? "Video is decoded by the graphics card's media engine" : "Light load — fans can stop",
      measured: [`${gpu.name}: ${gpu.idleW} W idle, ${gpu.videoW} W playing video (TechPowerUp)`, `Whole system at idle: ${cpu.idleSysW} W with ${cpu.name} (TechPowerUp)`],
      estimated: ["Browser memory: about 0.3 GB per tab", "CPU use: modelled"],
    };
  }
  if (w.app === "render") {
    const cpuW = cpu.loadW;
    const gpuW = gpu.idleW + 3;
    const { gpuC, gpuFan } = gpuThermal(gpu, gpuW);
    return {
      label: "3D render · all cores",
      fps: null,
      low1: null,
      frameMs: null,
      cpuUtil: 100,
      gpuUtil: 3,
      encoder: 0,
      ramGB: 18,
      vramGB: 1.2,
      cpuW,
      gpuW,
      wallW: wall(cpu, gpu, cpuW, gpuW),
      cpuC: cpuThermal(cpu, cpuW),
      gpuC,
      gpuFan,
      busyThreads: cpu.threads,
      limitedBy: "cpu",
      why: "Every core is busy — this one scales with core count",
      minutes: 12 / cpu.apps,
      measured: [`${cpu.name}: ${Math.round(cpu.apps * 100)}% of a 9800X3D in applications; ${cpu.loadW} W and ${cpu.loadC} °C in Blender (TechPowerUp)`],
      estimated: ["Render time: a 12-minute job on the 9800X3D, scaled by that index"],
    };
  }
  const cpuW = cpu.gamingW * 0.9;
  const gpuW = gpu.gamingW * 0.35;
  const { gpuC, gpuFan } = gpuThermal(gpu, gpuW);
  return {
    label: "4K video export · hardware encode",
    fps: null,
    low1: null,
    frameMs: null,
    cpuUtil: 42,
    gpuUtil: 36,
    encoder: 88,
    ramGB: 22,
    vramGB: 4.5,
    cpuW,
    gpuW,
    wallW: wall(cpu, gpu, cpuW, gpuW),
    cpuC: cpuThermal(cpu, cpuW),
    gpuC,
    gpuFan,
    busyThreads: Math.round(cpu.threads * 0.5),
    limitedBy: "gpu",
    why: "The card's video encoder does the heavy lifting",
    minutes: 6 * (91.6 / gpu.avg["4k"]) ** 0.4,
    measured: [],
    estimated: ["Export time scaled from the card's 4K average", "All values modelled"],
  };
}
