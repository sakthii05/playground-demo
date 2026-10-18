// Parts and measured benchmark data. Every figure is a published spec or was read from a review chart
// (sources at the bottom). Anything derived is marked where it is used.

export type Brand = "NVIDIA" | "AMD" | "Intel";
export type Res = "1080p" | "1440p" | "4k";
export type GpuFamily = "fe-large" | "fe-small" | "partner";
export type Socket = "LGA1851" | "AM5";

export interface Gpu {
  id: string;
  brand: Brand;
  name: string;
  family: GpuFamily; // which 3D model the scene shows
  cores: number;
  coreLabel: string;
  vram: number;
  memType: string;
  busBits: number;
  bandwidth: number; // GB/s
  power: number; // W, rated total board power
  psu: number; // W, recommended
  pcie: string;
  avg: Record<Res, number>; // TechPowerUp average FPS, 25 games, Ultra, Ryzen 7 9800X3D
  lowRatio: number; // 1% low ÷ average at 1440p (TechPowerUp minimum FPS chart)
  gamingW: number; // TechPowerUp measured, card only, gaming average
  gameC: number; // TechPowerUp measured GPU temperature while gaming
  fanRpm: number; // TechPowerUp measured fan speed while gaming (fans stop at idle)
  tested: string; // the card those thermals were measured on
  idleW: number; // TechPowerUp measured, card only, desktop idle
  videoW: number; // TechPowerUp measured, card only, video playback
}

export interface Cpu {
  id: string;
  brand: Brand;
  name: string;
  socket: Socket;
  cores: number;
  pCores: number;
  eCores: number;
  threads: number;
  boost: number; // GHz
  cache: number; // MB L3
  basePower: number; // W
  maxPower: number; // W
  gaming: number; // relative gaming performance at 1080p, 9800X3D = 1 (TechPowerUp, RTX 4090, Ultra)
  gaming1440: number; // the same at 1440p
  apps: number; // relative application performance, 9800X3D = 1 (TechPowerUp)
  gamingW: number; // TechPowerUp measured, CPU only, 13-game average
  gameC: number; // TechPowerUp measured, Cyberpunk 2077, Noctua NH-D15
  loadW: number; // TechPowerUp measured, Blender
  loadC: number; // TechPowerUp measured, Blender, NH-D15
  idleSysW: number; // TechPowerUp measured, whole test system at idle (includes an idle RTX 4090, 18 W)
}

export interface Board {
  id: string;
  chipset: string;
  socket: Socket;
  tier: "best" | "value";
  gpuSlot: string;
  m2: string;
  memory: string;
  oc: string;
  extras: string;
}

export const GPUS: Gpu[] = [
  { id: "rtx5090", brand: "NVIDIA", name: "GeForce RTX 5090", family: "fe-large", cores: 21760, coreLabel: "CUDA cores", vram: 32, memType: "GDDR7", busBits: 512, bandwidth: 1792, power: 575, psu: 1000, pcie: "5.0 ×16", avg: { "1080p": 240.0, "1440p": 205.8, "4k": 139.3 }, lowRatio: 0.787, gamingW: 520, gameC: 77, fanRpm: 1673, tested: "RTX 5090 Founders Edition", idleW: 30, videoW: 55 },
  { id: "rtx5080", brand: "NVIDIA", name: "GeForce RTX 5080", family: "fe-large", cores: 10752, coreLabel: "CUDA cores", vram: 16, memType: "GDDR7", busBits: 256, bandwidth: 960, power: 360, psu: 850, pcie: "5.0 ×16", avg: { "1080p": 187.8, "1440p": 149.1, "4k": 91.6 }, lowRatio: 0.817, gamingW: 296, gameC: 67, fanRpm: 1493, tested: "RTX 5080 Founders Edition", idleW: 14, videoW: 22 },
  { id: "rtx5070ti", brand: "NVIDIA", name: "GeForce RTX 5070 Ti", family: "partner", cores: 8960, coreLabel: "CUDA cores", vram: 16, memType: "GDDR7", busBits: 256, bandwidth: 896, power: 300, psu: 750, pcie: "5.0 ×16", avg: { "1080p": 171.5, "1440p": 133.1, "4k": 79.5 }, lowRatio: 0.816, gamingW: 279, gameC: 68, fanRpm: 2430, tested: "MSI RTX 5070 Ti Ventus 3X OC", idleW: 21, videoW: 28 },
  { id: "rtx5070", brand: "NVIDIA", name: "GeForce RTX 5070", family: "fe-small", cores: 6144, coreLabel: "CUDA cores", vram: 12, memType: "GDDR7", busBits: 192, bandwidth: 672, power: 250, psu: 650, pcie: "5.0 ×16", avg: { "1080p": 143.6, "1440p": 108.4, "4k": 63.2 }, lowRatio: 0.818, gamingW: 229, gameC: 77, fanRpm: 2578, tested: "RTX 5070 Founders Edition", idleW: 12, videoW: 16 },
  { id: "rx9070xt", brand: "AMD", name: "Radeon RX 9070 XT", family: "partner", cores: 4096, coreLabel: "stream processors", vram: 16, memType: "GDDR6", busBits: 256, bandwidth: 640, power: 304, psu: 750, pcie: "5.0 ×16", avg: { "1080p": 163.8, "1440p": 125.5, "4k": 74.5 }, lowRatio: 0.829, gamingW: 314, gameC: 57, fanRpm: 1301, tested: "Sapphire RX 9070 XT Pulse", idleW: 9, videoW: 30 },
  { id: "rx9070", brand: "AMD", name: "Radeon RX 9070", family: "partner", cores: 3584, coreLabel: "stream processors", vram: 16, memType: "GDDR6", busBits: 256, bandwidth: 640, power: 220, psu: 650, pcie: "5.0 ×16", avg: { "1080p": 151.6, "1440p": 114.3, "4k": 67.1 }, lowRatio: 0.835, gamingW: 233, gameC: 60, fanRpm: 1080, tested: "ASRock RX 9070 Steel Legend", idleW: 8, videoW: 27 },
];

export const CPUS: Cpu[] = [
  { id: "u9-285k", brand: "Intel", name: "Core Ultra 9 285K", socket: "LGA1851", cores: 24, pCores: 8, eCores: 16, threads: 24, boost: 5.7, cache: 36, basePower: 125, maxPower: 250, gaming: 0.879, gaming1440: 0.933, apps: 1.21, gamingW: 94, gameC: 58.5, loadW: 235, loadC: 88.2, idleSysW: 58 },
  { id: "u7-265k", brand: "Intel", name: "Core Ultra 7 265K", socket: "LGA1851", cores: 20, pCores: 8, eCores: 12, threads: 20, boost: 5.5, cache: 30, basePower: 125, maxPower: 250, gaming: 0.859, gaming1440: 0.922, apps: 1.133, gamingW: 77, gameC: 49.0, loadW: 155, loadC: 72.1, idleSysW: 57 },
  { id: "u5-245k", brand: "Intel", name: "Core Ultra 5 245K", socket: "LGA1851", cores: 14, pCores: 6, eCores: 8, threads: 14, boost: 5.2, cache: 24, basePower: 125, maxPower: 159, gaming: 0.841, gaming1440: 0.911, apps: 0.956, gamingW: 61, gameC: 44.1, loadW: 134, loadC: 61.2, idleSysW: 58 },
  { id: "r7-9800x3d", brand: "AMD", name: "Ryzen 7 9800X3D", socket: "AM5", cores: 8, pCores: 8, eCores: 0, threads: 16, boost: 5.2, cache: 96, basePower: 120, maxPower: 162, gaming: 1.0, gaming1440: 1.0, apps: 1.0, gamingW: 65, gameC: 60.8, loadW: 155, loadC: 86.7, idleSysW: 78 },
  { id: "r9-9950x", brand: "AMD", name: "Ryzen 9 9950X", socket: "AM5", cores: 16, pCores: 16, eCores: 0, threads: 32, boost: 5.7, cache: 64, basePower: 170, maxPower: 230, gaming: 0.892, gaming1440: 0.924, apps: 1.251, gamingW: 104, gameC: 67.6, loadW: 220, loadC: 74.8, idleSysW: 80 },
  { id: "r5-9600x", brand: "AMD", name: "Ryzen 5 9600X", socket: "AM5", cores: 6, pCores: 6, eCores: 0, threads: 12, boost: 5.4, cache: 32, basePower: 65, maxPower: 88, gaming: 0.884, gaming1440: 0.925, apps: 0.831, gamingW: 66, gameC: 65.0, loadW: 80, loadC: 65.4, idleSysW: 78 },
];

export const BOARDS: Board[] = [
  { id: "z890", chipset: "Intel Z890", socket: "LGA1851", tier: "best", gpuSlot: "PCIe 5.0 ×16", m2: "PCIe 5.0 + 4.0", memory: "DDR5, 4 slots", oc: "CPU + memory overclocking", extras: "Thunderbolt 4 on most boards" },
  { id: "b860", chipset: "Intel B860", socket: "LGA1851", tier: "value", gpuSlot: "PCIe 5.0 ×16", m2: "PCIe 4.0", memory: "DDR5, 2–4 slots", oc: "Memory overclocking only", extras: "Lower price, fewer USB and M.2" },
  { id: "x870e", chipset: "AMD X870E", socket: "AM5", tier: "best", gpuSlot: "PCIe 5.0 ×16", m2: "PCIe 5.0 + 4.0", memory: "DDR5, 4 slots", oc: "CPU + memory overclocking", extras: "USB4 required, two chipsets" },
  { id: "b850", chipset: "AMD B850", socket: "AM5", tier: "value", gpuSlot: "PCIe 4.0 or 5.0 ×16", m2: "PCIe 5.0", memory: "DDR5, 2–4 slots", oc: "CPU + memory overclocking", extras: "Lower price, one chipset" },
];

export interface Game {
  id: string;
  name: string;
  genre?: string;
  settings: string; // what the measured numbers were run at
  fps: Record<Res, Record<string, number>>;
  low?: Record<Res, Record<string, number>>; // measured 1% lows, where the source has them
  measured: Record<Res, string[]>; // which cards were measured at each resolution; the rest are scaled
  cpuWeight: number; // how CPU-sensitive the game is compared with TechPowerUp's average (1 = average)
  source: string;
}

const RTX4090 = { "1080p": 215.4, "1440p": 172.4, "4k": 105.7 };
const gpu = (id: string) => GPUS.find((g) => g.id === id)!;
const round = (v: number) => Math.round(v * 10) / 10;
const RESES: Res[] = ["1080p", "1440p", "4k"];
const TPU_CARDS = ["rtx5080", "rtx5070ti", "rtx5070", "rx9070xt", "rx9070"];

// TechPowerUp per-game charts. The RTX 5090 is not in them: its numbers are the RTX 4090's scaled by
// TechPowerUp's 5090 ÷ 4090 average at each resolution.
const tpu = (id: string, name: string, cpuWeight: number, rows: Record<Res, [number, number, number, number, number, number]>): Game => {
  const fps = {} as Game["fps"];
  for (const res of RESES) {
    const [r4090, r5080, r5070ti, r5070, xt, x] = rows[res];
    fps[res] = { rtx5090: round((r4090 * gpu("rtx5090").avg[res]) / RTX4090[res]), rtx5080: r5080, rtx5070ti: r5070ti, rtx5070: r5070, rx9070xt: xt, rx9070: x };
  }
  return { id, name, settings: "Ultra, no ray tracing", fps, measured: { "1080p": TPU_CARDS, "1440p": TPU_CARDS, "4k": TPU_CARDS }, cpuWeight, source: "TechPowerUp" };
};

// TechSpot measured GTA V Enhanced on the RTX 5070 Ti and RX 9070 XT (1440p and 4K, maximum RT quality,
// Ryzen 7 9800X3D). The other cards are scaled from the measured card of the same brand by TechPowerUp's
// averages, and 1080p from 1440p the same way.
function gtaV(): Game {
  const measured = { "1440p": { rtx5070ti: [140, 101], rx9070xt: [100, 88] }, "4k": { rtx5070ti: [67, 51], rx9070xt: [51, 40] } } as const;
  const fps = {} as Game["fps"];
  const low = {} as NonNullable<Game["low"]>;
  for (const res of ["1440p", "4k"] as const) {
    fps[res] = {};
    low[res] = {};
    for (const g of GPUS) {
      const base = g.brand === "AMD" ? "rx9070xt" : "rtx5070ti";
      const [avg, lo] = measured[res][base];
      const k = g.avg[res] / gpu(base).avg[res];
      fps[res][g.id] = round(avg * k);
      low[res][g.id] = round(lo * k);
    }
  }
  fps["1080p"] = {};
  low["1080p"] = {};
  for (const g of GPUS) {
    const k = g.avg["1080p"] / g.avg["1440p"];
    fps["1080p"][g.id] = round(fps["1440p"][g.id] * k);
    low["1080p"][g.id] = round(low["1440p"][g.id] * k);
  }
  return { id: "gtav", name: "GTA 5", settings: "Enhanced edition, Very High, maximum ray tracing", fps, low, measured: { "1080p": [], "1440p": ["rtx5070ti", "rx9070xt"], "4k": ["rtx5070ti", "rx9070xt"] }, cpuWeight: 1.3, source: "TechSpot" };
}

// Red Dead Redemption 2, max settings, Ryzen 7 9800X3D. Gamereactor measured the RTX 5080 at all three
// resolutions; Tech4Gamers measured the RTX 5070 Ti and RX 9070 XT at 4K (with 1% lows). NVIDIA cards are
// scaled from the 5080 by TechPowerUp's averages; AMD cards keep the 9070 XT's measured 4K gap to the 5080,
// adjusted at each resolution by the same averages.
function rdr2(): Game {
  const r5080 = { "1080p": 179.4, "1440p": 151.5, "4k": 108.4 };
  const xt4k = 90;
  const fps = {} as Game["fps"];
  for (const res of RESES) {
    fps[res] = {};
    for (const g of GPUS) {
      const ref = gpu("rtx5080");
      if (g.brand === "NVIDIA") fps[res][g.id] = round((r5080[res] * g.avg[res]) / ref.avg[res]);
      else {
        const xt = gpu("rx9070xt");
        const xtRes = (r5080[res] * (xt4k / r5080["4k"]) * (xt.avg[res] / ref.avg[res])) / (xt.avg["4k"] / ref.avg["4k"]);
        fps[res][g.id] = round((xtRes * g.avg[res]) / xt.avg[res]);
      }
    }
  }
  fps["4k"].rtx5080 = r5080["4k"];
  fps["4k"].rtx5070ti = 97;
  fps["4k"].rx9070xt = xt4k;
  const low = { "1080p": {}, "1440p": {}, "4k": { rtx5070ti: 84, rx9070xt: 76 } };
  return { id: "rdr2", name: "RDR 2", settings: "max settings", fps, low, measured: { "1080p": ["rtx5080"], "1440p": ["rtx5080"], "4k": ["rtx5080", "rtx5070ti", "rx9070xt"] }, cpuWeight: 0.8, source: "Gamereactor, Tech4Gamers" };
}

//                                                    4090   5080   5070Ti 5070   9070XT 9070
const META: Record<string, { genre: string }> = {
  cyberpunk: { genre: "Open-world RPG" },
  gtav: { genre: "Grand Theft Auto V · Enhanced" },
  rdr2: { genre: "Red Dead Redemption 2" },
  cs2: { genre: "Competitive shooter" },
  spiderman2: { genre: "Open-world action" },
  wukong: { genre: "Action RPG" },
};

export const GAMES: Game[] = [
  tpu("cyberpunk", "Cyberpunk 2077", 0.9, { "1080p": [234.8, 204.4, 185.0, 157.2, 185.0, 172.2], "1440p": [159.5, 137.6, 122.6, 104.2, 128.7, 117.0], "4k": [74.3, 69.6, 57.8, 49.1, 63.4, 57.1] }),
  gtaV(),
  rdr2(),
  tpu("cs2", "Counter-Strike 2", 1.5, { "1080p": [634.3, 544.2, 500.8, 428.0, 397.8, 381.3], "1440p": [454.5, 407.1, 358.7, 298.8, 262.0, 252.3], "4k": [233.2, 222.2, 192.2, 157.8, 122.8, 120.1] }),
  tpu("spiderman2", "Spider-Man 2", 1.0, { "1080p": [206.5, 188.1, 174.1, 137.2, 169.7, 153.3], "1440p": [169.4, 145.5, 130.6, 98.9, 123.9, 109.7], "4k": [99.6, 83.3, 73.1, 54.9, 68.8, 60.4] }),
  tpu("wukong", "Black Myth: Wukong", 0.4, { "1080p": [83.1, 72.3, 56.8, 49.0, 64.9, 58.1], "1440p": [67.5, 58.8, 53.4, 42.9, 50.3, 45.2], "4k": [43.3, 37.3, 32.7, 25.7, 30.7, 27.2] }),
].map((g) => ({ ...g, ...META[g.id] }));

export const SOURCES = [
  { label: "Game FPS, averages and 1% lows", detail: "TechPowerUp, ASUS RX 9070 XT TUF OC review — 25 games, Ultra, Ryzen 7 9800X3D", url: "https://www.techpowerup.com/review/asus-radeon-rx-9070-xt-tuf-oc/" },
  { label: "GTA 5 (Enhanced)", detail: "TechSpot, RX 9070 XT vs RTX 5070 Ti — maximum RT quality, Ryzen 7 9800X3D", url: "https://www.techspot.com/review/2970-amd-radeon-9070-xt-vs-nvidia-rtx-5070-ti/" },
  { label: "RDR 2 · RTX 5080", detail: "Gamereactor, RTX 5080 Founders Edition review — 1080p, 1440p and 4K, Ryzen 7 9800X3D", url: "https://www.gamereactor.eu/nvidia-rtx-5080-founders-edition-1489003/" },
  { label: "RDR 2 · 4K, RTX 5070 Ti vs RX 9070 XT", detail: "Tech4Gamers, RX 9070 XT vs RTX 5070 Ti — 4K max settings, Ryzen 7 9800X3D", url: "https://tech4gamers.com/rx-9070-xt-vs-rtx-5070-ti/" },
  { label: "Graphics card power, temperatures, fan speeds", detail: "TechPowerUp: gaming power (card only) and each card's own review", url: "https://www.techpowerup.com/review/asus-radeon-rx-9070-xt-tuf-oc/41.html" },
  { label: "CPU gaming index, power, temperatures", detail: "TechPowerUp Ryzen 7 9800X3D and Core Ultra 5 245K reviews (RTX 4090, Noctua NH-D15)", url: "https://www.techpowerup.com/review/amd-ryzen-7-9800x3d/" },
  { label: "Core Ultra 5 245K power and temperatures", detail: "TechPowerUp Core Ultra 5 245K review", url: "https://www.techpowerup.com/review/intel-core-ultra-5-245k/" },
];
