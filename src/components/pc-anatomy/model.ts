// What the page says about each part: kept to a name, the exact model and one line of specs.

export type AssemblyId = "case" | "fans" | "board" | "cpu" | "cooler" | "ram" | "gpu" | "psu" | "cables";

export interface Assembly {
  id: AssemblyId;
  no: string;
  name: string;
  model: string;
  spec: string;
}

export const ASSEMBLIES: Assembly[] = [
  { id: "case", no: "01", name: "Case", model: "Mid-tower, glass side and front", spec: "460 × 230 × 500 mm" },
  { id: "fans", no: "02", name: "Case fans", model: "4 × 120 mm", spec: "3 intake · 1 exhaust" },
  { id: "board", no: "03", name: "Motherboard", model: "Intel Z890 · ATX", spec: "LGA 1851 · PCIe 5.0 ×16 · 4 × DDR5" },
  { id: "cpu", no: "04", name: "Processor", model: "Intel Core Ultra 9 285K", spec: "24 cores · 5.7 GHz · 125 W" },
  { id: "cooler", no: "05", name: "Liquid cooler", model: "360 mm AIO", spec: "Pump with display · 3 × 120 mm" },
  { id: "ram", no: "06", name: "Memory", model: "Crucial Pro 4 × 16 GB DDR5-5600", spec: "64 GB · 89.6 GB/s · 31.9 mm low profile" },
  { id: "gpu", no: "07", name: "Graphics card", model: "NVIDIA GeForce RTX 5080 FE", spec: "10,752 CUDA · 16 GB GDDR7 · 360 W" },
  { id: "psu", no: "08", name: "Power supply", model: "850 W · ATX 3.1", spec: "80 PLUS Gold · 12V-2×6" },
  { id: "cables", no: "09", name: "Cables", model: "Sleeved, modular", spec: "24-pin · 2 × 8-pin · 16-pin" },
];

export const assemblyById = (id: string | null) => ASSEMBLIES.find((a) => a.id === id) ?? null;
