"use client";
// Pick a graphics card and a processor (either first), then a motherboard that fits, then Set up.
// Any GPU works with any CPU, so pairs get a balance badge; boards are filtered by the CPU's socket.
import { useEffect, useMemo, useState } from "react";
import type { Catalog } from "./hooks";
import { boardsFor, pairing, psuFor, type Match } from "../data/perf";
import { cx, FOCUS, MONO, SANS } from "./tw";

export interface Build {
  gpu: string;
  cpu: string;
  board: string;
}
type Step = "gpu" | "cpu" | "board";

const MATCH: Record<Match, string> = { balanced: "Balanced", good: "Best at 1440p+", "cpu-limited": "CPU-limited" };
const BADGE: Record<Match, string> = { balanced: "bg-[#eef7ee] text-[#2f7a35]", good: "bg-[#f2f5fb] text-[#2a5ea8]", "cpu-limited": "bg-[#fdf3e7] text-[#a35b0b]" };

export function BuildDrawer({ open, catalog, current, onClose, onSetup }: { open: boolean; catalog: Catalog | null; current: Build; onClose: () => void; onSetup: (b: Build) => void }) {
  const [draft, setDraft] = useState<Partial<Build>>(current);
  const [step, setStep] = useState<Step>("gpu");
  useEffect(() => {
    if (open) {
      setDraft(current);
      setStep("gpu");
    }
  }, [open, current]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && open && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const gpu = catalog?.gpus.find((g) => g.id === draft.gpu) ?? null;
  const cpu = catalog?.cpus.find((c) => c.id === draft.cpu) ?? null;
  const boards = useMemo(() => (cpu ? boardsFor(cpu) : []), [cpu]);
  const board = boards.find((b) => b.id === draft.board) ?? null;

  const pickCpu = (id: string) => {
    const next = catalog!.cpus.find((c) => c.id === id)!;
    const fits = boardsFor(next);
    setDraft((d) => ({ ...d, cpu: id, board: fits.some((b) => b.id === d.board) ? d.board : fits[0]?.id }));
  };
  const ready = Boolean(gpu && cpu && board);

  const row = (on: boolean) =>
    cx(
      "flex w-full cursor-pointer items-start justify-between gap-2.5 rounded-[14px] border px-3.5 py-3 text-left transition-[border-color,box-shadow] duration-200",
      on ? "border-neutral-950 shadow-[inset_0_0_0_1px_#0a0a0a]" : "border-neutral-200 hover:border-neutral-300",
      FOCUS,
    );
  const brand = "text-[10.5px] uppercase tracking-[0.08em] text-neutral-400";
  const spec = cx("text-[11px] text-neutral-600", MONO);
  const pill = "shrink-0 whitespace-nowrap rounded-full px-2 py-0.75 text-[10.5px]";

  return (
    <div className={cx("fixed inset-0 z-40 text-neutral-950", SANS, open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open} inert={!open}>
      <div onClick={onClose} className={cx("absolute inset-0 bg-neutral-50/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} />
      <aside
        role="dialog"
        aria-label="Build your PC"
        aria-modal="true"
        className={cx(
          "absolute flex flex-col overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.04)] transition-transform duration-450 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          "lg:inset-y-3 lg:right-3 lg:w-[min(420px,calc(100vw-24px))]",
          "max-lg:inset-x-2 max-lg:bottom-2 max-lg:h-[min(80svh,680px)]",
          open ? "translate-none" : "lg:translate-x-[calc(100%+24px)] max-lg:translate-y-[calc(100%+24px)]",
        )}
      >
        <header className="flex items-start justify-between px-5 pb-3 pt-5">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-neutral-400">Build</p>
            <h2 className="text-[24px] font-medium leading-none tracking-[-0.03em]">Choose your parts</h2>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={cx("grid size-8 cursor-pointer place-items-center rounded-full text-[20px] text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950", FOCUS)}>
            ×
          </button>
        </header>

        <nav className="grid grid-cols-3 gap-1.5 px-5 pb-3" role="tablist">
          {(
            [
              ["gpu", "Graphics", gpu?.name.replace(/^GeForce |^Radeon /, "")],
              ["cpu", "Processor", cpu?.name.replace(/^Core /, "")],
              ["board", "Motherboard", board?.chipset.replace(/^(Intel|AMD) /, "")],
            ] as [Step, string, string | undefined][]
          ).map(([id, label, value], i) => {
            const on = step === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                disabled={id === "board" && !cpu}
                onClick={() => setStep(id)}
                className={cx(
                  "grid min-w-0 cursor-pointer grid-cols-[auto_1fr] grid-rows-2 gap-x-1.75 rounded-xl border px-2.5 py-2.25 text-left transition-colors duration-200 disabled:cursor-default disabled:opacity-40",
                  on ? "border-neutral-950" : "border-neutral-200 hover:border-neutral-300",
                  FOCUS,
                )}
              >
                <span className={cx("row-span-2 grid size-4.5 place-items-center rounded-full text-[10px]", MONO, on ? "bg-neutral-950 text-white" : "bg-neutral-100")}>{i + 1}</span>
                <span className="text-[11px] text-neutral-400">{label}</span>
                <span className="truncate text-[12px] font-medium">{value ?? "—"}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-1 flex-col gap-1.5 overflow-auto overscroll-contain px-3 pb-3 pt-1" role="listbox" aria-label={step}>
          {!catalog && <p className="mx-2 mb-1.5 mt-1 text-[12px] text-neutral-400">Loading parts…</p>}
          {catalog && step === "gpu" &&
            catalog.gpus.map((g) => {
              const fit = cpu ? pairing(g, cpu) : null;
              return (
                <button key={g.id} type="button" role="option" aria-selected={draft.gpu === g.id} className={row(draft.gpu === g.id)} onClick={() => setDraft((d) => ({ ...d, gpu: g.id }))}>
                  <span className="flex min-w-0 flex-col gap-0.75">
                    <span className={brand}>{g.brand}</span>
                    <strong className="text-[15px] font-semibold">{g.name}</strong>
                    <span className={spec}>
                      {g.vram} GB {g.memType} · {g.power} W · {Math.round(g.avg["1440p"])} FPS avg 1440p
                    </span>
                  </span>
                  {fit && (
                    <span className={cx(pill, BADGE[fit.match])} title={fit.note}>
                      {MATCH[fit.match]}
                    </span>
                  )}
                </button>
              );
            })}
          {catalog && step === "cpu" &&
            catalog.cpus.map((c) => {
              const fit = gpu ? pairing(gpu, c) : null;
              return (
                <button key={c.id} type="button" role="option" aria-selected={draft.cpu === c.id} className={row(draft.cpu === c.id)} onClick={() => pickCpu(c.id)}>
                  <span className="flex min-w-0 flex-col gap-0.75">
                    <span className={brand}>
                      {c.brand} · {c.socket}
                    </span>
                    <strong className="text-[15px] font-semibold">{c.name}</strong>
                    <span className={spec}>
                      {c.cores} cores{c.eCores ? ` (${c.pCores}P + ${c.eCores}E)` : ""} · {c.boost} GHz · {Math.round(c.gaming * 100)}% gaming
                    </span>
                  </span>
                  {fit && (
                    <span className={cx(pill, BADGE[fit.match])} title={fit.note}>
                      {MATCH[fit.match]}
                    </span>
                  )}
                </button>
              );
            })}
          {catalog && step === "board" && (
            <>
              {cpu && (
                <p className="mx-2 mb-1.5 mt-1 text-[12px] text-neutral-400">
                  Showing {cpu.socket} boards — the socket the {cpu.name} needs.
                </p>
              )}
              {boards.map((b) => (
                <button key={b.id} type="button" role="option" aria-selected={draft.board === b.id} className={row(draft.board === b.id)} onClick={() => setDraft((d) => ({ ...d, board: b.id }))}>
                  <span className="flex min-w-0 flex-col gap-0.75">
                    <span className={brand}>{b.tier === "best" ? "High-end" : "Value"}</span>
                    <strong className="text-[15px] font-semibold">{b.chipset} · ATX</strong>
                    <span className={spec}>
                      {b.gpuSlot} · M.2 {b.m2} · {b.oc}
                    </span>
                    <span className="text-[12px] text-neutral-400">{b.reason}</span>
                  </span>
                  {b.recommended && <span className={cx(pill, BADGE.balanced)}>Recommended</span>}
                </button>
              ))}
            </>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-neutral-200 px-5 pb-4.5 pt-3.5">
          {gpu && cpu && (
            <p className="text-[12px] leading-normal text-neutral-600">
              {pairing(gpu, cpu).note}. {psuFor(gpu) > 850 ? `Power supply upgraded to ${psuFor(gpu)} W for the ${gpu.name}.` : "850 W power supply is enough."}
            </p>
          )}
          <div className="flex gap-2">
            {step !== "board" ? (
              <button
                type="button"
                disabled={step === "gpu" ? !gpu : !cpu}
                onClick={() => setStep(step === "gpu" ? "cpu" : "board")}
                className={cx("inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-neutral-950 px-4.5 text-[13px] font-medium transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-35", FOCUS)}
              >
                Next
              </button>
            ) : null}
            <button
              type="button"
              disabled={!ready}
              onClick={() => ready && onSetup({ gpu: gpu!.id, cpu: cpu!.id, board: board!.id })}
              className={cx("inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full bg-neutral-950 px-4.5 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-default disabled:opacity-35", FOCUS)}
            >
              Set up &amp; power on
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
