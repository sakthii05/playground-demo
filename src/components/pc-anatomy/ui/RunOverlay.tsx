"use client";
// The panel while the PC runs: choose a workload, watch it the way Task Manager would.
// Steady values come from /api/pc/profile (anchored on measured review data); the timeline moves
// around them. "Your device" shows this browser's own, real numbers.
import { useEffect, useMemo, useState } from "react";
import type { Res } from "../data/catalog";
import { Graph } from "./Graph";
import { GamePicker } from "./GamePicker";
import { Segmented, Toggle } from "./controls";
import { useDevice, useProfile, useTelemetry, type Catalog } from "./hooks";
import type { Build } from "./BuildDrawer";
import { cx, FOCUS, MONO } from "./tw";

type Tab = "game" | "browse" | "create" | "device";
type Preset = "ultra" | "high" | "medium";
const TABS: [Tab, string][] = [
  ["game", "Game"],
  ["browse", "Browse"],
  ["create", "Create"],
  ["device", "Your device"],
];
const RES: [Res, string][] = [
  ["1080p", "1080p"],
  ["1440p", "1440p"],
  ["4k", "4K"],
];
const PRESETS: [Preset, string][] = [
  ["ultra", "Ultra"],
  ["high", "High"],
  ["medium", "Medium"],
];
const JOBS: ["render" | "export", string][] = [
  ["render", "3D render · CPU"],
  ["export", "4K export · GPU"],
];

function Panel({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.25">
      <div className="flex justify-between gap-1.5 whitespace-nowrap text-[11px] text-neutral-600">
        <span>{title}</span>
        <span className={MONO}>{value}</span>
      </div>
      {children}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[10px] bg-neutral-50 p-2">
      <dt className="text-[10.5px] text-neutral-400">{label}</dt>
      <dd className={cx("whitespace-nowrap text-[12px]", MONO)}>{value}</dd>
    </div>
  );
}
const r0 = (v: number) => String(Math.round(v));

export function RunOverlay({ catalog, build, running, onSample }: { catalog: Catalog | null; build: Build; running: boolean; onSample?: (s: { cpuC: number; gpuC: number; load: number }) => void }) {
  const [tab, setTab] = useState<Tab>("game");
  const [game, setGame] = useState("cyberpunk");
  const [res, setRes] = useState<Res>("1440p");
  const [preset, setPreset] = useState<Preset>("ultra");
  const [upscale, setUpscale] = useState(false);
  const [framegen, setFramegen] = useState(false);
  const [tabs, setTabs] = useState(12);
  const [video, setVideo] = useState(true);
  const [app, setApp] = useState<"render" | "export">("render");
  const [open, setOpen] = useState(true);

  const cpu = catalog?.cpus.find((c) => c.id === build.cpu);
  const gpu = catalog?.gpus.find((g) => g.id === build.gpu);
  const query = useMemo(() => {
    const base = `gpu=${build.gpu}&cpu=${build.cpu}`;
    if (tab === "game") return `${base}&kind=game&game=${game}&res=${res}&preset=${preset}&upscale=${+upscale}&framegen=${+framegen}`;
    if (tab === "browse") return `${base}&kind=browse&tabs=${tabs}&video=${+video}`;
    if (tab === "create") return `${base}&kind=create&app=${app}`;
    return `${base}&kind=browse&tabs=4&video=0`;
  }, [build, tab, game, res, preset, upscale, framegen, tabs, video, app]);
  const { profile, loading } = useProfile(running ? query : null);
  const history = useTelemetry(profile, cpu?.threads ?? 16, running);
  const { device, fps: devFps } = useDevice(running && tab === "device");
  const last = history[history.length - 1];
  useEffect(() => {
    if (last && onSample) onSample({ cpuC: last.cpuC, gpuC: last.gpuC, load: Math.max(last.cpu, last.gpu) / 100 });
  }, [last, onSample]);

  // the headline number is the last 3 seconds' average, like an FPS counter, not one jumpy sample
  const recent = history.slice(-6);
  const shownFps = recent.length ? recent.reduce((a, b) => a + b.fps, 0) / recent.length : 0;
  const isGame = tab === "game";
  const series = (k: "fps" | "cpu" | "gpu" | "ram" | "vram") => history.map((s) => s[k]);
  const fpsMax = Math.max(60, ...series("fps")) * 1.15;
  const g = catalog?.games.find((x) => x.id === game);
  const upscaler = gpu?.brand === "AMD" ? "FSR 4" : "DLSS 4";

  return (
    <section
      data-pc-panel
      aria-label="Live performance"
      className={cx(
        "rounded-[18px] border border-neutral-200 bg-white text-[12px] text-neutral-950 transition-[opacity,translate] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] starting:translate-y-2 starting:opacity-0",
        "lg:absolute lg:right-[clamp(16px,3.2vw,44px)] lg:top-2 lg:z-30 lg:max-h-[calc(100%-16px)] lg:w-85 lg:overflow-auto lg:overscroll-contain lg:bg-white/90 lg:shadow-[0_18px_50px_-28px_rgba(0,0,0,0.25)] lg:backdrop-blur-xl lg:scrollbar-thin",
        "max-lg:relative max-lg:z-0 max-lg:mt-2.5",
      )}
    >
      <header className="z-2 flex items-center gap-2.5 rounded-t-[18px] bg-white/95 py-3 pl-3.5 pr-2.5 lg:sticky lg:top-0">
        <span className={cx("inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.06em]", MONO)}>
          <i className="size-1.75 rounded-full bg-[#2aa8f0] shadow-[0_0_0_4px_#e3f5ff]" /> Live
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-600">
          {gpu?.name.replace(/^GeForce |^Radeon /, "") ?? "…"} · {cpu?.name ?? "…"}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse panel" : "Expand panel"}
          onClick={() => setOpen((o) => !o)}
          className={cx("grid size-7.5 cursor-pointer place-items-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950", FOCUS)}
        >
          <svg viewBox="0 0 16 16" className={cx("size-4 fill-none stroke-current stroke-[1.6] transition-transform duration-300 [stroke-linecap:round] [stroke-linejoin:round]", !open && "rotate-180")} aria-hidden>
            <path d="M4 10l4-4 4 4" />
          </svg>
        </button>
      </header>

      {open && (
        <div className="flex flex-col gap-3.5 px-3.5 pb-3.5">
          <Segmented kind="tab" label="Workload" value={tab} onChange={setTab} options={TABS} />

          {tab !== "device" && (
            <div className="flex flex-col gap-3">
              {isGame && (
                <>
                  <GamePicker games={catalog?.games ?? []} value={game} onChange={setGame} />
                  <div className="grid grid-cols-2 gap-2">
                    <Segmented size="sm" label="Resolution" value={res} onChange={setRes} options={RES} />
                    <Segmented size="sm" label="Quality" value={preset} onChange={setPreset} options={PRESETS} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Toggle on={upscale} onChange={setUpscale}>
                      {upscaler} Quality
                    </Toggle>
                    <Toggle on={framegen} onChange={setFramegen}>
                      Frame generation
                    </Toggle>
                  </div>
                </>
              )}
              {tab === "browse" && (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="flex justify-between text-[11px] text-neutral-400">
                      Open tabs <b className={cx("font-medium text-neutral-950", MONO)}>{tabs}</b>
                    </span>
                    <input type="range" min={1} max={40} value={tabs} onChange={(e) => setTabs(Number(e.target.value))} aria-label="Open tabs" className="w-full cursor-pointer accent-neutral-950" />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <Toggle on={video} onChange={setVideo}>
                      4K video playing
                    </Toggle>
                  </div>
                </>
              )}
              {tab === "create" && <Segmented label="Job" value={app} onChange={setApp} options={JOBS} />}
            </div>
          )}

          {tab === "device" ? (
            <div>
              <dl className="mb-2.5 flex flex-col">
                {(
                  [
                    ["Graphics", device?.gpu ?? "—"],
                    ["CPU threads", device?.threads ?? "—"],
                    ["Memory", device?.memory ? `About ${device.memory} GB` : "Not shared by this browser"],
                    ["Display", device?.screen ?? "—"],
                    ["System", device?.platform ?? "—"],
                    ...(device?.heapMB != null ? [["This page's memory", `${device.heapMB} MB`]] : []),
                  ] as [string, string | number][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-neutral-200 py-1.75">
                    <dt className="whitespace-nowrap text-neutral-400">{k}</dt>
                    <dd className={cx("text-right text-[11px]", MONO)}>{v}</dd>
                  </div>
                ))}
              </dl>
              <Panel title="This page · frames per second" value={devFps.length ? `${r0(devFps[devFps.length - 1])} FPS` : "—"}>
                <Graph data={devFps} max={Math.max(65, ...devFps) * 1.1} tone="fps" />
              </Panel>
              <p className="mt-2 text-[11px] text-neutral-400">Read live from your browser. Nothing leaves this page.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 border-t border-neutral-200 pt-3" aria-live="polite">
                <div className="flex min-h-11.5 items-end gap-2">
                  {profile?.fps != null && last ? (
                    <>
                      <span className={cx("text-[46px] font-medium leading-[0.88] tracking-[-0.035em]", MONO)}>{r0(shownFps)}</span>
                      <span className="flex flex-col pb-px text-[12px] text-neutral-600">
                        FPS
                        <small className="whitespace-nowrap text-[11px] text-neutral-400">
                          1% low {r0(profile.low1 ?? 0)} · {profile.frameMs?.toFixed(1)} ms
                        </small>
                      </span>
                    </>
                  ) : profile?.minutes != null && last ? (
                    <>
                      <span className={cx("text-[46px] font-medium leading-[0.88] tracking-[-0.035em]", MONO)}>{profile.minutes.toFixed(1)}</span>
                      <span className="flex flex-col pb-px text-[12px] text-neutral-600">
                        min
                        <small className="text-[11px] text-neutral-400">{app === "render" ? "to render" : "to export"}</small>
                      </span>
                    </>
                  ) : (
                    <span className="pb-px text-[12px] text-neutral-600">{loading || !last ? "Starting…" : profile?.label}</span>
                  )}
                  {profile && profile.limitedBy !== "none" && last && (
                    <span
                      className={cx(
                        "ml-auto self-center whitespace-nowrap rounded-full px-2.25 py-1 text-[10.5px] font-medium",
                        profile.limitedBy === "cpu" ? "bg-[#fdf3e7] text-[#a35b0b]" : "bg-[#eef7ee] text-[#2f7a35]",
                      )}
                    >
                      {profile.limitedBy === "cpu" ? "CPU-bound" : "GPU-bound"}
                    </span>
                  )}
                </div>
                {profile && last && <p className="mt-1 text-[12px] text-neutral-600">{profile.why}</p>}
                {isGame && g && <p className="text-[11px] text-neutral-400">Tested at {g.settings}</p>}
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-2.5">
                <Panel title="CPU" value={last ? `${r0(last.cpu)}%` : "—"}>
                  <Graph data={series("cpu")} max={100} tone="cpu" />
                </Panel>
                <Panel title="GPU" value={last ? `${r0(last.gpu)}%` : "—"}>
                  <Graph data={series("gpu")} max={100} tone="gpu" />
                </Panel>
                <Panel title="Memory" value={last ? `${last.ram.toFixed(1)} / 64 GB` : "—"}>
                  <Graph data={series("ram")} max={64} tone="mem" />
                </Panel>
                {isGame ? (
                  <Panel title="Frame rate" value={last ? `${r0(last.fps)} FPS` : "—"}>
                    <Graph data={series("fps")} max={fpsMax} tone="fps" />
                  </Panel>
                ) : (
                  <Panel title="GPU memory" value={last && gpu ? `${last.vram.toFixed(1)} / ${gpu.vram} GB` : "—"}>
                    <Graph data={series("vram")} max={gpu?.vram ?? 16} tone="gpu" />
                  </Panel>
                )}
              </div>

              {last && (
                <div className="flex flex-col gap-1.25 text-[11px] text-neutral-400">
                  <span>{cpu?.threads ?? last.cores.length} threads</span>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(9px,1fr))] gap-0.75" aria-hidden>
                    {last.cores.map((c, i) => (
                      <i key={i} className="h-2.25 rounded-[3px] bg-[#1a7fc4] transition-opacity duration-500" style={{ opacity: 0.12 + (c / 100) * 0.88 }} />
                    ))}
                  </div>
                </div>
              )}

              <dl className="grid grid-cols-4 gap-1.5 max-[420px]:grid-cols-2">
                <Stat label="CPU" value={last ? `${r0(last.cpuC)} °C` : "—"} />
                <Stat label="GPU" value={last ? `${r0(last.gpuC)} °C` : "—"} />
                <Stat label="GPU fans" value={last ? (last.fan > 40 ? `${r0(last.fan)} rpm` : "Stopped") : "—"} />
                <Stat label="Wall" value={last ? `${r0(last.watts)} W` : "—"} />
              </dl>

              {profile && (
                <details className="group/src text-[11px] text-neutral-600">
                  <summary className={cx("cursor-pointer list-none rounded text-neutral-400 transition-colors hover:text-neutral-950 [&::-webkit-details-marker]:hidden", FOCUS)}>
                    Where these numbers come from <span className="inline-block transition-transform group-open/src:rotate-180">▾</span>
                  </summary>
                  <ul className="mt-2.5 flex flex-col gap-1.5 leading-[1.45]">
                    {profile.measured.map((m) => (
                      <li key={m}>
                        <b className="mr-1.5 inline-block rounded-full bg-[#eef7ee] px-1.5 py-px text-[10px] font-medium text-[#2f7a35]">Measured</b>
                        {m}
                      </li>
                    ))}
                    {profile.estimated.map((m) => (
                      <li key={m}>
                        <b className="mr-1.5 inline-block rounded-full bg-neutral-100 px-1.5 py-px text-[10px] font-medium text-neutral-600">Estimated</b>
                        {m}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 leading-[1.45] text-neutral-400">
                    {catalog?.sources.map((s, i) => (
                      <span key={s.url}>
                        {i ? " · " : ""}
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-neutral-600 underline underline-offset-2 hover:text-neutral-950">
                          {s.label}
                        </a>
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 leading-[1.45] text-neutral-400">The graphs move around these steady values; the second-to-second wiggle is simulated.</p>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
