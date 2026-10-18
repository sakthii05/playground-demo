"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Live } from "./scene/kit";
import { assemblyById } from "./model";
import { BuildDrawer, type Build } from "./ui/BuildDrawer";
import { RunOverlay } from "./ui/RunOverlay";
import { useCatalog } from "./ui/hooks";
import { cx, FOCUS, GUTTER, MONO, SANS } from "./ui/tw";

const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => <div className="size-full bg-[radial-gradient(closest-side,#f4f4f2,#fff)]" aria-hidden /> });

const CREDIT = "https://sakthi-portfolio-mauve.vercel.app/";
const WIDE = "(min-width: 1024px)";

const DEFAULT_BUILD: Build = { gpu: "rtx5080", cpu: "u9-285k", board: "z890" };

export default function PcAnatomy() {
  const catalog = useCatalog();
  const [on, setOn] = useState(false);
  const [apart, setApart] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [build, setBuild] = useState<Build>(DEFAULT_BUILD);
  const [drawer, setDrawer] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

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

  // zoom: wheel and pinch share one target, 100% → 250%. The camera eases toward it every frame;
  // React only hears about it once a frame, for the % pill, so the 3D scene never re-renders mid-gesture.
  const [zoom, setZoomState] = useState(1);
  const zoomFrame = useRef(0);
  const setZoom = useCallback((z: number) => {
    live.current.zoom = Math.min(2.5, Math.max(1, z));
    if (zoomFrame.current) return;
    zoomFrame.current = requestAnimationFrame(() => {
      zoomFrame.current = 0;
      setZoomState(live.current.zoom);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(zoomFrame.current), []);
  // a native, non-passive listener, so the wheel (and a trackpad pinch, which arrives as ctrl + wheel)
  // zooms the PC instead of scrolling or zooming the page
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const dy = Math.max(-120, Math.min(120, px));
      setZoom(live.current.zoom * Math.exp(-dy * (e.ctrlKey ? 0.008 : 0.0016)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom]);
  const pinch = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ d: number; z: number } | null>(null);
  const span = () => {
    const [a, b] = [...pinch.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const figureHandlers = {
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

  // while it runs on a wide screen, the panel sits on the right: fit the PC into the space
  // between the intro and the panel
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      const wide = on && window.matchMedia(WIDE).matches;
      live.current.shift = wide ? 1 : 0;
      const canvas = canvasRef.current?.getBoundingClientRect();
      const copy = copyRef.current?.getBoundingClientRect();
      const panel = document.querySelector("[data-pc-panel]")?.getBoundingClientRect();
      if (!wide || !canvas || !copy) return;
      const left = copy.right + 16;
      const right = (panel?.left ?? canvas.right) - 16;
      live.current.gap = { dx: ((left + right) / 2 - (canvas.left + canvas.width / 2)) / canvas.width, w: Math.max(0.3, (right - left) / canvas.width) };
    };
    raf = requestAnimationFrame(apply);
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", apply);
    };
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

  const parts: [string, string][] = [
    ["GPU", gpu?.name.replace(/^GeForce |^Radeon /, "") ?? "RTX 5080"],
    ["CPU", cpu?.name.replace(/^Core /, "") ?? "Ultra 9 285K"],
    ["Board", board?.chipset.replace(/^(Intel|AMD) /, "") ?? "Z890"],
  ];

  return (
    <section
      className={cx("group/pca relative flex h-svh min-h-140 flex-col overflow-clip bg-white text-neutral-950 antialiased max-lg:h-auto max-lg:min-h-svh", SANS)}
      data-running={on || undefined}
      aria-labelledby="pca-title"
    >
      <header className={cx("relative z-2 flex h-14 shrink-0 items-center justify-between text-[12px]", GUTTER)}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">PC / Anatomy</span>
        <a href={CREDIT} target="_blank" rel="noreferrer" className={cx("group/credit inline-flex items-center gap-1.5 rounded-full text-[11.5px] text-neutral-500 transition-colors hover:text-neutral-950", FOCUS)}>
          Created by
          <span className="font-medium text-neutral-950 underline decoration-neutral-300 underline-offset-[3px] transition-colors group-hover/credit:decoration-neutral-950">@sakthi</span>
          <svg viewBox="0 0 16 16" className="size-3 fill-none stroke-current stroke-[1.6] transition-transform group-hover/credit:-translate-y-px group-hover/credit:translate-x-px" aria-hidden>
            <path d="M5 11l6-6M6 5h5v5" />
          </svg>
        </a>
      </header>

      <div
        className={cx(
          "relative grid min-h-0 flex-1 grid-cols-[minmax(300px,0.62fr)_1.38fr] grid-rows-[minmax(0,1fr)] items-center pb-[clamp(16px,3vw,36px)]",
          "max-lg:grid-cols-1 max-lg:grid-rows-none max-lg:content-start max-lg:gap-1.5",
          GUTTER,
        )}
      >
        {/* the copy sits over the canvas's left edge: only its own controls take the pointer */}
        <div ref={copyRef} className="pointer-events-none relative z-2 flex flex-col gap-4.5 *:pointer-events-auto max-lg:order-last max-lg:gap-3 max-lg:pt-1.5">
          <p className={cx("text-[11px] uppercase tracking-[0.14em] text-neutral-400 ", MONO)}>Anatomy Nº 01</p>
          <h1 id="pca-title" className="text-[clamp(44px,5.6vw,88px)] font-medium leading-[0.92] tracking-[-0.045em] max-lg:text-[clamp(40px,11vw,60px)]">
            Inside the <span className="block text-neutral-400 max-lg:inline">machine.</span>
          </h1>
          <p className={cx("text-[15px] text-neutral-600")}>Pick the parts, power it on, and see how it really performs.</p>
          <div className="mt-1.5 flex flex-wrap gap-2.5">
            <button
              type="button"
              aria-pressed={on}
              onClick={() => power()}
              className={cx(
                "inline-flex h-10.5 cursor-pointer items-center gap-2.25 rounded-full pl-3.5 pr-4.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-300",
                on ? "bg-white text-neutral-950 shadow-[inset_0_0_0_1px_#0a0a0a,0_0_0_4px_#e6f6ff]" : "bg-neutral-950 text-white hover:bg-neutral-800",
                FOCUS,
              )}
            >
              <svg viewBox="0 0 24 24" className={cx("size-4.25 fill-none stroke-2 transition-[stroke] duration-300 [stroke-linecap:round]", on ? "stroke-[#2aa8f0]" : "stroke-current")} aria-hidden>
                <path d="M12 3v8" />
                <path d="M6.6 6.4a8 8 0 1 0 10.8 0" />
              </svg>
              {on ? "Power off" : "Power on"}
            </button>
            <button
              type="button"
              aria-pressed={apart}
              onClick={explode}
              className={cx(
                "inline-flex h-10.5 cursor-pointer items-center rounded-full border border-neutral-950 px-5 text-[13px] font-medium transition-colors duration-300",
                apart ? "bg-neutral-950 text-white" : "hover:bg-neutral-50",
                FOCUS,
              )}
            >
              {apart ? "Assemble" : "Explode"}
            </button>
          </div>

          {/* the build: what is installed now, tap to change it */}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={`Change parts. Current build: ${parts.map(([k, v]) => `${k} ${v}`).join(", ")}`}
            className={cx(
              "group/build mt-1 w-full max-w-100 cursor-pointer rounded-2xl border border-neutral-200 bg-white p-1.5 text-left transition-[border-color,box-shadow] duration-200 hover:border-neutral-300 hover:shadow-[0_12px_32px_-20px_rgba(0,0,0,0.3)]",
              FOCUS,
            )}
          >
            <span className="flex items-center justify-between py-1 pl-2.5 pr-1">
              <span className="text-[10.5px] uppercase tracking-[0.12em] text-neutral-400">Your build</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950 py-1 pl-2.5 pr-2 text-[11px] font-medium text-white transition-[gap] duration-200 group-hover/build:gap-1.5">
                Change parts
                <svg viewBox="0 0 16 16" className="size-3 fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]" aria-hidden>
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </span>
            </span>
            <span className="mt-1 grid grid-cols-3 gap-1">
              {parts.map(([k, v]) => (
                <span key={k} className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-neutral-50 px-2.5 py-2 transition-colors group-hover/build:bg-neutral-100/70">
                  <span className="text-[10px] text-neutral-400">{k}</span>
                  <span className="truncate text-[12.5px] font-medium">{v}</span>
                </span>
              ))}
            </span>
          </button>
        </div>

        <div
          className={cx(
            "relative min-h-0 self-stretch max-lg:order-first max-lg:h-[min(118vw,64svh)]",
            // phone, running: the PC stays pinned on top while the panel scrolls under it
            "max-lg:group-data-running/pca:sticky max-lg:group-data-running/pca:top-0 max-lg:group-data-running/pca:z-10 max-lg:group-data-running/pca:h-[min(46svh,100vw)]",
            // a white backing across the full width (gutters too), so nothing scrolling under shows at the sides
            "max-lg:group-data-running/pca:before:absolute max-lg:group-data-running/pca:before:inset-y-0 max-lg:group-data-running/pca:before:-inset-x-[clamp(16px,3.2vw,44px)] max-lg:group-data-running/pca:before:bg-white max-lg:group-data-running/pca:before:shadow-[0_1px_0_#e5e5e5]",
          )}
        >
          <div
            ref={canvasRef}
            // desktop: up under the 3.5rem header and down through the bottom padding, so the scene is full height
            className="absolute inset-[-3.5rem_-6vw_calc(clamp(16px,3vw,36px)*-1)_-12vw] touch-pan-y max-lg:inset-[-10px_calc(-1*clamp(16px,3.2vw,44px))_0] [&_canvas]:outline-none"
            {...figureHandlers}
            onPointerCancel={figureHandlers.onPointerUp}
          >
            <Scene live={live} variant={variant} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between text-[11px] text-neutral-400">
            <span className={cx("inline-flex items-center gap-1.75 uppercase tracking-[0.04em]", MONO, on && "text-neutral-950")}>
              <i className={cx("size-1.75 rounded-full transition-[background-color,box-shadow] duration-500", on ? "bg-[#2aa8f0] shadow-[0_0_0_4px_#e3f5ff]" : "bg-[#cfd1d4]")} />
              {on ? "Running" : "Off"}
            </span>
            <span className="max-sm:hidden">Drag to rotate · Scroll or pinch to zoom · Tap a part</span>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={() => setZoom(1)}
              className={cx(
                "cursor-pointer rounded-full border border-neutral-200 bg-white px-2.5 py-1.25 text-[11px] text-neutral-950 transition-[opacity,translate,border-color] duration-200 hover:border-neutral-950",
                MONO,
                FOCUS,
                zoom > 1.01 ? "pointer-events-auto opacity-100" : "pointer-events-none translate-y-1 opacity-0",
              )}
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>

          {/* the part you tapped: small, out of the way */}
          <div
            aria-live="polite"
            className={cx(
              "absolute bottom-7 left-0 flex max-w-[min(300px,100%)] items-start gap-2 rounded-xl border border-neutral-200 bg-white/95 py-2 pl-2.5 pr-1.5 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.3)] backdrop-blur transition-[opacity,translate] duration-300",
              part ? "opacity-100" : "pointer-events-none translate-y-1.5 opacity-0",
            )}
          >
            {part && (
              <>
                <span className={cx("pt-px text-[10px] text-neutral-400", MONO)}>{part.no}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <strong className="text-[13px] font-semibold leading-tight">{part.model}</strong>
                  <span className="text-[11px] leading-snug text-neutral-500">
                    {part.name} · {part.spec}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => live.current.pick(null)}
                  className={cx("grid size-5 shrink-0 cursor-pointer place-items-center rounded-full text-[14px] leading-none text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950", FOCUS)}
                >
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
