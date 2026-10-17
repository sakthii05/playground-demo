"use client";
// The overlay while the PC runs: pick a workload, see it the way Task Manager would.
// Steady values come from /api/pc/profile (measured where TechPowerUp measured them); the timeline
// moves around them. The Device tab shows this browser's own, real numbers.
import { useEffect, useMemo, useState } from "react";
import type { Res } from "../data/catalog";
import { Graph } from "./Graph";
import { useDevice, useProfile, useTelemetry, type Catalog } from "./hooks";
import type { Build } from "./BuildDrawer";

type Tab = "game" | "browse" | "create" | "stream" | "device";
const TABS: [Tab, string][] = [
  ["game", "Game"],
  ["browse", "Browse"],
  ["create", "Create"],
  ["stream", "Stream"],
  ["device", "Your device"],
];

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pco-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" className="pco-toggle" aria-pressed={on} onClick={() => onChange(!on)}>
      <i />
      {children}
    </button>
  );
}
function Panel({ title, value, children }: { title: string; value: string; children: React.ReactNode }) {
  return (
    <div className="pco-panel">
      <div className="pco-panel-head">
        <span>{title}</span>
        <span className="pco-mono">{value}</span>
      </div>
      {children}
    </div>
  );
}

export function RunOverlay({ catalog, build, running, onSample }: { catalog: Catalog | null; build: Build; running: boolean; onSample?: (s: { cpuC: number; gpuC: number; load: number }) => void }) {
  const [tab, setTab] = useState<Tab>("game");
  const [game, setGame] = useState("cyberpunk");
  const [res, setRes] = useState<Res>("1440p");
  const [preset, setPreset] = useState<"ultra" | "high" | "medium">("ultra");
  const [upscale, setUpscale] = useState(false);
  const [framegen, setFramegen] = useState(false);
  const [tabs, setTabs] = useState(12);
  const [video, setVideo] = useState(true);
  const [app, setApp] = useState<"render" | "export">("render");
  const [sources, setSources] = useState(false);
  const [open, setOpen] = useState(true);

  const cpu = catalog?.cpus.find((c) => c.id === build.cpu);
  const gpu = catalog?.gpus.find((g) => g.id === build.gpu);
  const query = useMemo(() => {
    const base = `gpu=${build.gpu}&cpu=${build.cpu}`;
    if (tab === "game") return `${base}&kind=game&game=${game}&res=${res}&preset=${preset}&upscale=${+upscale}&framegen=${+framegen}`;
    if (tab === "browse") return `${base}&kind=browse&tabs=${tabs}&video=${+video}`;
    if (tab === "create") return `${base}&kind=create&app=${app}`;
    if (tab === "stream") return `${base}&kind=stream&game=${game}&res=${res}`;
    return `${base}&kind=browse&tabs=4&video=0`;
  }, [build, tab, game, res, preset, upscale, framegen, tabs, video, app]);
  const { profile, loading } = useProfile(running ? query : null);
  const history = useTelemetry(profile, cpu?.threads ?? 16, running);
  const { device, fps: devFps } = useDevice(running && tab === "device");
  const last = history[history.length - 1];
  useEffect(() => {
    if (last && onSample) onSample({ cpuC: last.cpuC, gpuC: last.gpuC, load: Math.max(last.cpu, last.gpu) / 100 });
  }, [last, onSample]);

  const isGame = tab === "game" || tab === "stream";
  const series = (k: "fps" | "cpu" | "gpu" | "ram" | "vram") => history.map((s) => s[k]);
  const fpsMax = Math.max(60, ...series("fps")) * 1.15;
  const gameName = catalog?.games.find((g) => g.id === game)?.name;

  return (
    <section className="pco" data-open={open || undefined} data-running={running || undefined} aria-label="Live performance">
      <header className="pco-head">
        <span className="pco-live">
          <i /> {running ? "Live" : "Off"}
        </span>
        <span className="pco-build">
          {gpu?.name.replace(/^GeForce |^Radeon /, "") ?? "…"} · {cpu?.name ?? "…"}
        </span>
        <button type="button" className="pco-collapse" aria-expanded={open} aria-label={open ? "Collapse" : "Expand"} onClick={() => setOpen((o) => !o)}>
          {open ? "–" : "+"}
        </button>
      </header>

      {open && (
        <>
          <nav className="pco-tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </nav>

          <div className="pco-controls">
            {isGame && catalog && (
              <div className="pco-games">
                {catalog.games.map((g) => (
                  <button key={g.id} type="button" aria-pressed={game === g.id} onClick={() => setGame(g.id)}>
                    {g.name}
                  </button>
                ))}
              </div>
            )}
            {isGame && (
              <Seg
                label="Resolution"
                value={res}
                onChange={setRes}
                options={[
                  ["1080p", "1080p"],
                  ["1440p", "1440p"],
                  ["4k", "4K"],
                ]}
              />
            )}
            {tab === "game" && (
              <>
                <Seg
                  label="Preset"
                  value={preset}
                  onChange={setPreset}
                  options={[
                    ["ultra", "Ultra"],
                    ["high", "High"],
                    ["medium", "Medium"],
                  ]}
                />
                <div className="pco-row">
                  <Toggle on={upscale} onChange={setUpscale}>
                    {gpu?.brand === "AMD" ? "FSR" : "DLSS"} Quality
                  </Toggle>
                  <Toggle on={framegen} onChange={setFramegen}>
                    Frame gen
                  </Toggle>
                </div>
              </>
            )}
            {tab === "browse" && (
              <>
                <label className="pco-slider">
                  <span>Tabs</span>
                  <input type="range" min={1} max={40} value={tabs} onChange={(e) => setTabs(Number(e.target.value))} />
                  <span className="pco-mono">{tabs}</span>
                </label>
                <Toggle on={video} onChange={setVideo}>
                  4K video playing
                </Toggle>
              </>
            )}
            {tab === "create" && (
              <Seg
                label="Job"
                value={app}
                onChange={setApp}
                options={[
                  ["render", "3D render · CPU"],
                  ["export", "4K export · GPU"],
                ]}
              />
            )}
          </div>

          {tab === "device" ? (
            <div className="pco-device">
              <dl>
                <div>
                  <dt>Graphics</dt>
                  <dd>{device?.gpu ?? "—"}</dd>
                </div>
                <div>
                  <dt>CPU threads</dt>
                  <dd>{device?.threads ?? "—"}</dd>
                </div>
                <div>
                  <dt>Memory</dt>
                  <dd>{device?.memory ? `About ${device.memory} GB (rounded by the browser)` : "Not shared by this browser"}</dd>
                </div>
                <div>
                  <dt>Display</dt>
                  <dd>{device?.screen ?? "—"}</dd>
                </div>
                <div>
                  <dt>System</dt>
                  <dd>{device?.platform ?? "—"}</dd>
                </div>
                {device?.heapMB != null && (
                  <div>
                    <dt>This page&apos;s memory</dt>
                    <dd>{device.heapMB} MB</dd>
                  </div>
                )}
              </dl>
              <Panel title="This page, frames per second" value={devFps.length ? `${Math.round(devFps[devFps.length - 1])} FPS` : "—"}>
                <Graph data={devFps} max={Math.max(65, ...devFps) * 1.1} tone="fps" />
              </Panel>
              <p className="pco-fine">Read live from your browser. Nothing leaves this page.</p>
            </div>
          ) : (
            <>
              <div className="pco-hero">
                {profile?.fps != null && last ? (
                  <>
                    <span className="pco-big pco-mono">{Math.round(last.fps)}</span>
                    <span className="pco-unit">
                      FPS
                      <small>1% low {Math.round(profile.low1 ?? 0)}</small>
                    </span>
                    <span className="pco-limit" data-by={profile.limitedBy}>
                      {profile.limitedBy === "cpu" ? "CPU-limited" : "GPU-limited"}
                    </span>
                  </>
                ) : profile?.minutes != null ? (
                  <>
                    <span className="pco-big pco-mono">{profile.minutes.toFixed(1)}</span>
                    <span className="pco-unit">
                      min
                      <small>{app === "render" ? "render time" : "export time"}</small>
                    </span>
                  </>
                ) : (
                  <span className="pco-unit">{loading || !last ? "Starting…" : profile?.label}</span>
                )}
              </div>
              <div className="pco-grid">
                <Panel title="CPU" value={last ? `${Math.round(last.cpu)}%` : "—"}>
                  <Graph data={series("cpu")} max={100} tone="cpu" />
                </Panel>
                <Panel title="GPU" value={last ? `${Math.round(last.gpu)}%` : "—"}>
                  <Graph data={series("gpu")} max={100} tone="gpu" />
                </Panel>
                <Panel title="Memory" value={last ? `${last.ram.toFixed(1)} / 64 GB` : "—"}>
                  <Graph data={series("ram")} max={64} tone="mem" />
                </Panel>
                {isGame ? (
                  <Panel title="Frame rate" value={last ? `${Math.round(last.fps)} FPS` : "—"}>
                    <Graph data={series("fps")} max={fpsMax} tone="fps" />
                  </Panel>
                ) : (
                  <Panel title="GPU memory" value={last && gpu ? `${last.vram.toFixed(1)} / ${gpu.vram} GB` : "—"}>
                    <Graph data={series("vram")} max={gpu?.vram ?? 16} tone="gpu" />
                  </Panel>
                )}
              </div>
              {last && (
                <div className="pco-cores" aria-label="CPU threads">
                  {last.cores.map((c, i) => (
                    <i key={i} style={{ opacity: 0.12 + (c / 100) * 0.88 }} />
                  ))}
                </div>
              )}
              <div className="pco-stats pco-mono">
                <span>CPU {last ? Math.round(last.cpuC) : "—"}°C</span>
                <span>GPU {last ? Math.round(last.gpuC) : "—"}°C</span>
                <span>{last ? Math.round(last.watts) : "—"} W wall</span>
                {isGame && <span>VRAM {last ? last.vram.toFixed(1) : "—"} GB</span>}
              </div>
              <button type="button" className="pco-src" aria-expanded={sources} onClick={() => setSources((s) => !s)}>
                {profile?.measured.length ? "Measured data · TechPowerUp" : "Modelled"} {sources ? "▴" : "▾"}
              </button>
              {sources && profile && (
                <div className="pco-srclist">
                  {profile.measured.map((m) => (
                    <p key={m}>
                      <b>Measured</b> {m}
                    </p>
                  ))}
                  {profile.estimated.map((m) => (
                    <p key={m}>
                      <b>Estimated</b> {m}
                    </p>
                  ))}
                  {catalog?.sources.slice(0, 2).map((s) => (
                    <p key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.detail}
                      </a>
                    </p>
                  ))}
                  {isGame && gameName && <p>Graph wiggle is simulated around these averages.</p>}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
