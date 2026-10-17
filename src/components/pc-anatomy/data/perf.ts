// Compatibility rules and the workload model. Gaming FPS comes straight from the measured tables;
// what is modelled on top of them (CPU scaling, presets, upscaling, utilisation, power) is marked
// `estimated` in the profile so the page can say so.
import { BOARDS, CPUS, GAMES, GPUS, type Board, type Cpu, type Gpu, type Res } from "./catalog";

export const gpuById = (id: string) => GPUS.find((g) => g.id === id) ?? null;
export const cpuById = (id: string) => CPUS.find((c) => c.id === id) ?? null;
export const boardById = (id: string) => BOARDS.find((b) => b.id === id) ?? null;
export const gameById = (id: string) => GAMES.find((g) => g.id === id) ?? null;

// ---------- compatibility ----------
export type Match = "balanced" | "good" | "cpu-limited";
/** How well a CPU keeps up with a GPU in games: CPUs all fit any GPU, so this is balance, not a hard rule. */
export function pairing(gpu: Gpu, cpu: Cpu): { match: Match; note: string } {
  const pull = (1 - cpu.gaming) * (gpu.avg["1080p"] / 215.4);
  if (pull > 0.105) return { match: "cpu-limited", note: "Holds the card back at 1080p" };
  if (pull > 0.07) return { match: "good", note: "Small loss at 1080p, none at 4K" };
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
export type Workload =
  | { kind: "game"; game: string; res: Res; preset: "ultra" | "high" | "medium"; upscale: boolean; framegen: boolean }
  | { kind: "browse"; tabs: number; video: boolean }
  | { kind: "create"; app: "render" | "export" }
  | { kind: "stream"; game: string; res: Res };

export interface Profile {
  label: string;
  fps: number | null;
  low1: number | null;
  cpuUtil: number; // %
  gpuUtil: number; // %
  encoder: number; // % of the video engine
  ramGB: number;
  vramGB: number;
  cpuW: number;
  gpuW: number;
  cpuC: number;
  gpuC: number;
  busyThreads: number;
  limitedBy: "gpu" | "cpu" | "none";
  measured: string[];
  estimated: string[];
  minutes?: number; // for render/export jobs
}

const RES_DOWN: Record<Res, Res | null> = { "4k": "1440p", "1440p": "1080p", "1080p": null };
const RES_W: Record<Res, number> = { "1080p": 0.95, "1440p": 0.6, "4k": 0.25 };
const VRAM: Record<Res, number> = { "1080p": 7.2, "1440p": 8.6, "4k": 11.0 };
const thermal = (cpu: Cpu, gpu: Gpu, cpuW: number, gpuW: number) => ({ cpuC: Math.round(28 + cpuW * (cpu.brand === "AMD" ? 0.3 : 0.24)), gpuC: Math.round(31 + (41 * gpuW) / gpu.power) });

function gaming(gpu: Gpu, cpu: Cpu, gameId: string, res: Res, preset: "ultra" | "high" | "medium", upscale: boolean, framegen: boolean, stream = false): Profile {
  const g = gameById(gameId) ?? GAMES[0];
  const measured = [`${g.name} ${res} Ultra: ${g.fps[res][gpu.id]} FPS on ${gpu.name} (TechPowerUp${gpu.id === "rtx5090" ? ", scaled from RTX 4090" : ""})`];
  const estimated: string[] = [];
  let fps = g.fps[res][gpu.id];
  if (upscale) {
    const lower = RES_DOWN[res];
    fps = lower ? g.fps[lower][gpu.id] * 0.92 : fps * 1.22;
    estimated.push(lower ? `Upscaling: rendered at ${lower} (measured) less 8% upscaler cost` : "Upscaling at 1080p: +22%");
  }
  if (preset !== "ultra") {
    fps *= preset === "high" ? 1.22 : 1.45;
    estimated.push(`${preset === "high" ? "High" : "Medium"} preset: +${preset === "high" ? 22 : 45}% over Ultra`);
  }
  // CPU scaling: the measured numbers use a Ryzen 7 9800X3D; slower CPUs lose frames where the CPU is the limit
  const bound = Math.min(1, RES_W[upscale ? RES_DOWN[res] ?? res : res] * (gpu.avg["1080p"] / 215.4) * (0.6 + g.cpuHeavy));
  const cpuLoss = bound * (1 - cpu.gaming);
  fps *= 1 - cpuLoss;
  if (cpu.id !== "r7-9800x3d") estimated.push(`CPU scaling: −${Math.round(cpuLoss * 100)}% from TechPowerUp's CPU gaming index`);
  let low1 = fps * gpu.lowRatio * (1 - cpuLoss * 0.3);
  if (framegen) {
    fps *= 1.75;
    low1 *= 1.6;
    estimated.push("Frame generation 2×: +75% shown frames (adds latency)");
  }
  if (stream) {
    fps *= 0.95;
    low1 *= 0.93;
    estimated.push("Streaming: −5% for capture and encode");
  }
  const gpuUtil = Math.max(55, Math.min(99, 98 - cpuLoss * 110));
  const busyThreads = Math.min(cpu.threads, 6 + 6 * g.cpuHeavy + (stream ? 2 : 0));
  const cpuUtil = Math.min(100, (busyThreads / cpu.threads) * 78 * (0.8 + 0.4 * Math.min(1.5, fps / 200)));
  const gpuW = gpu.power * (0.5 + 0.48 * (gpuUtil / 100));
  const cpuW = Math.min(cpu.maxPower, cpu.basePower * (cpu.brand === "AMD" ? 0.45 : 0.42) + cpuUtil * 0.6);
  estimated.push("Utilisation, power, temperatures and memory: modelled");
  return { label: `${g.name} · ${res}`, fps, low1, cpuUtil, gpuUtil, encoder: stream ? 22 : 0, ramGB: 14.5 + (stream ? 2.5 : 0), vramGB: Math.min(gpu.vram - 0.4, VRAM[res] * (g.cpuHeavy > 0.55 ? 0.6 : 1) + (stream ? 0.6 : 0)), cpuW, gpuW, ...thermal(cpu, gpu, cpuW, gpuW), busyThreads, limitedBy: cpuLoss > 0.06 ? "cpu" : "gpu", measured, estimated };
}

export function profile(gpu: Gpu, cpu: Cpu, w: Workload): Profile {
  if (w.kind === "game") return gaming(gpu, cpu, w.game, w.res, w.preset, w.upscale, w.framegen);
  if (w.kind === "stream") return { ...gaming(gpu, cpu, w.game, w.res, "ultra", false, false, true), label: `Streaming ${gameById(w.game)?.name ?? ""} · 1080p60 to viewers` };
  if (w.kind === "browse") {
    const cpuUtil = Math.min(60, 3 + w.tabs * 0.55 + (w.video ? 9 : 0));
    const cpuW = cpu.basePower * 0.18 + cpuUtil * 0.5;
    const gpuW = gpu.power * 0.06 + (w.video ? 14 : 0);
    return { label: `${w.tabs} browser tabs${w.video ? " + 4K video" : ""}`, fps: null, low1: null, cpuUtil, gpuUtil: 3 + (w.video ? 14 : 0) + w.tabs * 0.1, encoder: 0, ramGB: Math.min(60, 4.2 + w.tabs * 0.29 + (w.video ? 0.8 : 0)), vramGB: 0.9 + w.tabs * 0.03, cpuW, gpuW, ...thermal(cpu, gpu, cpuW, gpuW), busyThreads: Math.min(cpu.threads, 2 + w.tabs / 6), limitedBy: "none", measured: [], estimated: ["Browser memory: about 0.3 GB per tab", "All values modelled"] };
  }
  // create: an all-core CPU render, or a 4K export on the GPU's video engine
  if (w.app === "render") {
    const cpuW = cpu.maxPower * 0.97;
    const gpuW = gpu.power * 0.07;
    return { label: "3D render, all cores", fps: null, low1: null, cpuUtil: 100, gpuUtil: 4, encoder: 0, ramGB: 18, vramGB: 1.2, cpuW, gpuW, ...thermal(cpu, gpu, cpuW, gpuW), busyThreads: cpu.threads, limitedBy: "cpu", minutes: 12 / cpu.apps, measured: [`${cpu.name}: ${Math.round(cpu.apps * 100)}% of a 9800X3D in applications (TechPowerUp)`], estimated: ["Render time: a 12-minute job on the 9800X3D, scaled by that index", "Power, temperatures: modelled"] };
  }
  const cpuW = cpu.basePower * 0.75;
  const gpuW = gpu.power * 0.42;
  return { label: "4K video export, hardware encode", fps: null, low1: null, cpuUtil: 46, gpuUtil: 38, encoder: 88, ramGB: 22, vramGB: 4.5, cpuW, gpuW, ...thermal(cpu, gpu, cpuW, gpuW), busyThreads: Math.round(cpu.threads * 0.5), limitedBy: "gpu", minutes: 6 * (91.6 / gpu.avg["4k"]) ** 0.4, measured: [], estimated: ["Export time scaled from the card's 4K average", "All values modelled"] };
}
