// Parts and measured benchmark data. Every figure is either a published spec or read from
// TechPowerUp's charts (sources at the bottom); anything derived says so where it is used.

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
  power: number; // W, total board power
  psu: number; // W, recommended
  pcie: string;
  avg: Record<Res, number>; // TechPowerUp average FPS, 25 games, Ultra
  lowRatio: number; // 1% low ÷ average at 1440p (TechPowerUp minimum FPS chart)
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
  gaming: number; // relative gaming performance at 1080p, 9800X3D = 1 (TechPowerUp, RTX 4090)
  apps: number; // relative application performance, 9800X3D = 1 (TechPowerUp)
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
  { id: "rtx5090", brand: "NVIDIA", name: "GeForce RTX 5090", family: "fe-large", cores: 21760, coreLabel: "CUDA cores", vram: 32, memType: "GDDR7", busBits: 512, bandwidth: 1792, power: 575, psu: 1000, pcie: "5.0 ×16", avg: { "1080p": 240.0, "1440p": 205.8, "4k": 139.3 }, lowRatio: 0.787 },
  { id: "rtx5080", brand: "NVIDIA", name: "GeForce RTX 5080", family: "fe-large", cores: 10752, coreLabel: "CUDA cores", vram: 16, memType: "GDDR7", busBits: 256, bandwidth: 960, power: 360, psu: 850, pcie: "5.0 ×16", avg: { "1080p": 187.8, "1440p": 149.1, "4k": 91.6 }, lowRatio: 0.817 },
  { id: "rtx5070ti", brand: "NVIDIA", name: "GeForce RTX 5070 Ti", family: "partner", cores: 8960, coreLabel: "CUDA cores", vram: 16, memType: "GDDR7", busBits: 256, bandwidth: 896, power: 300, psu: 750, pcie: "5.0 ×16", avg: { "1080p": 171.5, "1440p": 133.1, "4k": 79.5 }, lowRatio: 0.816 },
  { id: "rtx5070", brand: "NVIDIA", name: "GeForce RTX 5070", family: "fe-small", cores: 6144, coreLabel: "CUDA cores", vram: 12, memType: "GDDR7", busBits: 192, bandwidth: 672, power: 250, psu: 650, pcie: "5.0 ×16", avg: { "1080p": 143.6, "1440p": 108.4, "4k": 63.2 }, lowRatio: 0.818 },
  { id: "rx9070xt", brand: "AMD", name: "Radeon RX 9070 XT", family: "partner", cores: 4096, coreLabel: "stream processors", vram: 16, memType: "GDDR6", busBits: 256, bandwidth: 640, power: 304, psu: 750, pcie: "5.0 ×16", avg: { "1080p": 163.8, "1440p": 125.5, "4k": 74.5 }, lowRatio: 0.829 },
  { id: "rx9070", brand: "AMD", name: "Radeon RX 9070", family: "partner", cores: 3584, coreLabel: "stream processors", vram: 16, memType: "GDDR6", busBits: 256, bandwidth: 640, power: 220, psu: 650, pcie: "5.0 ×16", avg: { "1080p": 151.6, "1440p": 114.3, "4k": 67.1 }, lowRatio: 0.835 },
];

export const CPUS: Cpu[] = [
  { id: "u9-285k", brand: "Intel", name: "Core Ultra 9 285K", socket: "LGA1851", cores: 24, pCores: 8, eCores: 16, threads: 24, boost: 5.7, cache: 36, basePower: 125, maxPower: 250, gaming: 0.879, apps: 1.21 },
  { id: "u7-265k", brand: "Intel", name: "Core Ultra 7 265K", socket: "LGA1851", cores: 20, pCores: 8, eCores: 12, threads: 20, boost: 5.5, cache: 30, basePower: 125, maxPower: 250, gaming: 0.859, apps: 1.133 },
  { id: "u5-245k", brand: "Intel", name: "Core Ultra 5 245K", socket: "LGA1851", cores: 14, pCores: 6, eCores: 8, threads: 14, boost: 5.2, cache: 24, basePower: 125, maxPower: 159, gaming: 0.841, apps: 0.956 },
  { id: "r7-9800x3d", brand: "AMD", name: "Ryzen 7 9800X3D", socket: "AM5", cores: 8, pCores: 8, eCores: 0, threads: 16, boost: 5.2, cache: 96, basePower: 120, maxPower: 162, gaming: 1.0, apps: 1.0 },
  { id: "r9-9950x", brand: "AMD", name: "Ryzen 9 9950X", socket: "AM5", cores: 16, pCores: 16, eCores: 0, threads: 32, boost: 5.7, cache: 64, basePower: 170, maxPower: 230, gaming: 0.892, apps: 1.251 },
  { id: "r5-9600x", brand: "AMD", name: "Ryzen 5 9600X", socket: "AM5", cores: 6, pCores: 6, eCores: 0, threads: 12, boost: 5.4, cache: 32, basePower: 65, maxPower: 88, gaming: 0.884, apps: 0.831 },
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
  genre: string;
  // TechPowerUp per-game average FPS (Ultra, test CPU Ryzen 7 9800X3D). RTX 5090 is not in the
  // per-game charts: its numbers are the RTX 4090's scaled by TechPowerUp's 5090/4090 averages.
  fps: Record<Res, Record<string, number>>;
  cpuHeavy: number; // how much of the frame is CPU-bound at 1080p (0–1), for the CPU scaling
}

const RTX4090 = { "1080p": 215.4, "1440p": 172.4, "4k": 105.7 };
const r5090 = (res: Res, fps4090: number) => Math.round(((fps4090 * GPUS[0].avg[res]) / RTX4090[res]) * 10) / 10;
const game = (id: string, name: string, genre: string, cpuHeavy: number, rows: Record<Res, [number, number, number, number, number, number]>): Game => {
  const fps = {} as Game["fps"];
  for (const res of ["1080p", "1440p", "4k"] as Res[]) {
    const [r4090, r5080, r5070ti, r5070, xt, x] = rows[res];
    fps[res] = { rtx5090: r5090(res, r4090), rtx5080: r5080, rtx5070ti: r5070ti, rtx5070: r5070, rx9070xt: xt, rx9070: x };
  }
  return { id, name, genre, fps, cpuHeavy };
};
//                                                       4090   5080   5070Ti 5070   9070XT 9070
export const GAMES: Game[] = [
  game("cyberpunk", "Cyberpunk 2077", "Open-world RPG", 0.35, { "1080p": [234.8, 204.4, 185.0, 157.2, 185.0, 172.2], "1440p": [159.5, 137.6, 122.6, 104.2, 128.7, 117.0], "4k": [74.3, 69.6, 57.8, 49.1, 63.4, 57.1] }),
  game("wukong", "Black Myth: Wukong", "Action", 0.15, { "1080p": [83.1, 72.3, 56.8, 49.0, 64.9, 58.1], "1440p": [67.5, 58.8, 53.4, 42.9, 50.3, 45.2], "4k": [43.3, 37.3, 32.7, 25.7, 30.7, 27.2] }),
  game("cs2", "Counter-Strike 2", "Competitive shooter", 0.6, { "1080p": [634.3, 544.2, 500.8, 428.0, 397.8, 381.3], "1440p": [454.5, 407.1, 358.7, 298.8, 262.0, 252.3], "4k": [233.2, 222.2, 192.2, 157.8, 122.8, 120.1] }),
  game("spiderman2", "Spider-Man 2", "Open-world action", 0.4, { "1080p": [206.5, 188.1, 174.1, 137.2, 169.7, 153.3], "1440p": [169.4, 145.5, 130.6, 98.9, 123.9, 109.7], "4k": [99.6, 83.3, 73.1, 54.9, 68.8, 60.4] }),
  game("eldenring", "Elden Ring", "Action RPG", 0.5, { "1080p": [201.6, 196.1, 191.5, 189.4, 167.9, 160.9], "1440p": [195.2, 190.9, 180.1, 153.7, 130.2, 121.9], "4k": [132.9, 126.1, 110.4, 88.9, 78.8, 71.4] }),
  game("mhwilds", "Monster Hunter Wilds", "Open-world action", 0.45, { "1080p": [90.1, 84.7, 79.1, 67.1, 87.6, 80.9], "1440p": [79.5, 71.6, 65.6, 53.5, 71.2, 65.0], "4k": [55.4, 48.4, 43.2, 34.3, 45.8, 41.3] }),
];

export const SOURCES = [
  { label: "GPU averages, per-game FPS, 1% lows", detail: "TechPowerUp, ASUS Radeon RX 9070 XT TUF OC review (test system GPU 2025.2: Ryzen 7 9800X3D, DDR5-6200)", url: "https://www.techpowerup.com/review/asus-radeon-rx-9070-xt-tuf-oc/" },
  { label: "CPU gaming and application scaling", detail: "TechPowerUp, AMD Ryzen 7 9800X3D review (RTX 4090, 1080p Ultra; applications average)", url: "https://www.techpowerup.com/review/amd-ryzen-7-9800x3d/" },
  { label: "RTX 5090 per-game", detail: "Estimated: RTX 4090 per-game FPS × TechPowerUp's 5090 ÷ 4090 average at each resolution", url: "https://www.techpowerup.com/review/asus-radeon-rx-9070-xt-tuf-oc/31.html" },
];
