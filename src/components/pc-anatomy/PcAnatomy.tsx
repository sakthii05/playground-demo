"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Live } from "./scene/kit";
import { assemblyById } from "./model";
import { BuildDrawer, type Build } from "./ui/BuildDrawer";
import { RunOverlay } from "./ui/RunOverlay";
import { useCatalog } from "./ui/hooks";
import "./pc-anatomy.css";
import "./pc-overlay.css";

const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <div className="pca-loading" aria-hidden /> });

const DEFAULT_BUILD: Build = { gpu: "rtx5080", cpu: "u9-285k", board: "z890" };

export default function PcAnatomy() {
  const catalog = useCatalog();
  const [on, setOn] = useState(false);
  const [apart, setApart] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [build, setBuild] = useState<Build>(DEFAULT_BUILD);
  const [drawer, setDrawer] = useState(false);

  const live = useRef<Live>({
    power: false,
    level: 0,
    apart: false,
    t: 0,
    zoom: 1,
    zoomed: 1,
    picked: null,
    hovered: null,
    temps: { cpuC: 30, gpuC: 30, load: 0 },
    shift: 0,
    pick: () => {},
    hover: () => {},
    togglePower: () => {},
  });

  const power = useCallback((next?: boolean) => {
    setOn((was) => {
      const v = next ?? !was;
      live.current.power = v;
      return v;
    });
  }, []);
  const explode = useCallback(() => {
    setApart((was) => {
      live.current.apart = !was;
      return !was;
    });
  }, []);

  // the scene calls these from its own events
  live.current.togglePower = () => power();
  live.current.pick = (id) => {
    live.current.picked = id;
    setPicked(id);
  };
  live.current.hover = (id) => {
    live.current.hovered = id;
    document.body.style.cursor = id ? "pointer" : "";
  };

  const gpu = catalog?.gpus.find((g) => g.id === build.gpu);
  const cpu = catalog?.cpus.find((c) => c.id === build.cpu);
  const board = catalog?.boards.find((b) => b.id === build.board);
  const variant = useMemo(
    () => ({ gpuFamily: gpu?.family ?? "fe-large", gpuBrand: gpu?.brand ?? "NVIDIA", gpuName: gpu?.name ?? "GeForce RTX 5080", socket: cpu?.socket ?? "LGA1851", cpuName: cpu?.name ?? "Core Ultra 9 285K", cpuBrand: cpu?.brand ?? "Intel", chipset: board?.chipset ?? "Intel Z890", tier: board?.tier ?? "best" }),
    [gpu, cpu, board],
  );

  // the tag says what is installed now, not a fixed list
  const part = useMemo(() => {
    const a = assemblyById(picked);
    if (!a) return null;
    if (a.id === "gpu" && gpu) return { ...a, model: `${gpu.brand} ${gpu.name}`, spec: `${gpu.cores.toLocaleString()} ${gpu.coreLabel} · ${gpu.vram} GB ${gpu.memType} · ${gpu.power} W` };
    if (a.id === "cpu" && cpu) return { ...a, model: `${cpu.brand} ${cpu.name}`, spec: `${cpu.cores} cores · ${cpu.boost} GHz · ${cpu.basePower} W` };
    if (a.id === "board" && board) return { ...a, model: `${board.chipset} · ATX`, spec: `${board.socket} · ${board.gpuSlot} · ${board.memory}` };
    if (a.id === "psu" && gpu) return { ...a, spec: `${Math.max(850, gpu.psu)} W · 80 PLUS Gold · ATX 3.1` };
    return a;
  }, [picked, gpu, cpu, board]);

  // zoom: wheel and pinch share one value, 100% → 250%
  const [zoom, setZoomState] = useState(1);
  const setZoom = useCallback((z: number) => {
    const v = Math.min(2.5, Math.max(1, z));
    live.current.zoom = v;
    setZoomState(v);
  }, []);
  const pinch = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ d: number; z: number } | null>(null);
  const span = () => {
    const [a, b] = [...pinch.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const figureHandlers = {
    onWheel: (e: React.WheelEvent) => setZoom(live.current.zoom * Math.exp(-e.deltaY * 0.0012)),
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current.size === 2) pinchStart.current = { d: span(), z: live.current.zoom };
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pinch.current.has(e.pointerId)) return;
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current.size === 2 && pinchStart.current) setZoom((pinchStart.current.z * span()) / pinchStart.current.d);
    },
    onPointerUp: (e: React.PointerEvent) => {
      pinch.current.delete(e.pointerId);
      if (pinch.current.size < 2) pinchStart.current = null;
    },
  };

  // preview a build from the URL: ?gpu=rx9070xt&cpu=r7-9800x3d&board=x870e
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("gpu") || q.has("cpu")) setBuild((b) => ({ gpu: q.get("gpu") ?? b.gpu, cpu: q.get("cpu") ?? b.cpu, board: q.get("board") ?? b.board }));
    if (q.has("run")) power(true);
  }, [power]);

  // while it runs on a wide screen, the overlay sits on the right and the picture moves left
  useEffect(() => {
    const apply = () => (live.current.shift = on && window.innerWidth > 900 ? 1 : 0);
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [on]);

  const setup = (b: Build) => {
    setBuild(b);
    setDrawer(false);
    if (apart) explode();
    power(true);
  };
  const onSample = useCallback((s: { cpuC: number; gpuC: number; load: number }) => {
    live.current.temps = s;
  }, []);

  return (
    <section className="pca" data-running={on || undefined} aria-labelledby="pca-title">
      <header className="pca-bar">
        <span className="pca-mark">PC / Anatomy</span>
        <span className="pca-bar-meta">
          {cpu?.name ?? "Core Ultra 9 285K"} · {gpu?.name.replace(/^GeForce /, "") ?? "RTX 5080"}
        </span>
      </header>

      <div className="pca-hero">
        <div className="pca-copy">
          <p className="pca-eyebrow">Anatomy Nº 01</p>
          <h1 id="pca-title" className="pca-title">
            Inside the <em>machine.</em>
          </h1>
          <p className="pca-lede">Build it, power it on, push it.</p>
          <div className="pca-actions">
            <button type="button" className="pca-power" aria-pressed={on} onClick={() => power()}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 3v8" />
                <path d="M6.6 6.4a8 8 0 1 0 10.8 0" />
              </svg>
              {on ? "Power off" : "Power on"}
            </button>
            <button type="button" className="pca-ghost" onClick={() => setDrawer(true)}>
              Build
            </button>
            <button type="button" className="pca-ghost" aria-pressed={apart} onClick={explode}>
              {apart ? "Assemble" : "Explode"}
            </button>
          </div>
        </div>

        <div className="pca-figure">
          <div className="pca-canvas" {...figureHandlers} onPointerCancel={figureHandlers.onPointerUp}>
            <Scene live={live} variant={variant} />
          </div>
          <div className="pca-hud">
            <span className="pca-status" data-on={on || undefined}>
              <i />
              {on ? "Running" : "Off"}
            </span>
            <span className="pca-hint">Drag to rotate · Scroll or pinch to zoom · Tap a part</span>
            <button type="button" className="pca-zoomlevel" data-show={zoom > 1.01 || undefined} aria-label="Reset zoom" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
          </div>
          <div className="pca-tag" data-show={part ? "" : undefined} aria-live="polite">
            {part && (
              <>
                <span className="pca-tag-no">{part.no}</span>
                <span className="pca-tag-body">
                  <strong>{part.model}</strong>
                  <span>
                    {part.name} · {part.spec}
                  </span>
                </span>
                <button type="button" aria-label="Close" onClick={() => live.current.pick(null)}>
                  ×
                </button>
              </>
            )}
          </div>
        </div>

        {on && <RunOverlay catalog={catalog} build={build} running={on} onSample={onSample} />}
      </div>

      <BuildDrawer open={drawer} catalog={catalog} current={build} onClose={() => setDrawer(false)} onSetup={setup} />
    </section>
  );
}
