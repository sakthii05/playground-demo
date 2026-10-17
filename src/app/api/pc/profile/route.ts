import { NextResponse, type NextRequest } from "next/server";
import { cpuById, gpuById, profile, type Workload } from "@/components/pc-anatomy/data/perf";
import type { Res } from "@/components/pc-anatomy/data/catalog";

// A steady-state profile for a build running a workload. Measured figures and the estimates made on
// top of them are listed separately in the response.
//   /api/pc/profile?gpu=rtx5080&cpu=u9-285k&kind=game&game=cyberpunk&res=1440p&preset=ultra&upscale=0&framegen=0
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const gpu = gpuById(q.get("gpu") ?? "");
  const cpu = cpuById(q.get("cpu") ?? "");
  if (!gpu || !cpu) return NextResponse.json({ error: "unknown gpu or cpu" }, { status: 400 });
  const res = (["1080p", "1440p", "4k"].includes(q.get("res") ?? "") ? q.get("res") : "1440p") as Res;
  const kind = q.get("kind") ?? "game";
  let w: Workload;
  if (kind === "browse") w = { kind, tabs: Math.max(1, Math.min(60, Number(q.get("tabs") ?? 12))), video: q.get("video") === "1" };
  else if (kind === "create") w = { kind, app: q.get("app") === "export" ? "export" : "render" };
  else if (kind === "stream") w = { kind, game: q.get("game") ?? "cyberpunk", res };
  else w = { kind: "game", game: q.get("game") ?? "cyberpunk", res, preset: (["ultra", "high", "medium"].includes(q.get("preset") ?? "") ? q.get("preset") : "ultra") as "ultra" | "high" | "medium", upscale: q.get("upscale") === "1", framegen: q.get("framegen") === "1" };
  return NextResponse.json({ build: { gpu: gpu.id, cpu: cpu.id }, workload: w, profile: profile(gpu, cpu, w) });
}
