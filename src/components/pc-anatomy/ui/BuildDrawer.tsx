"use client";
// Pick a graphics card and a processor (either first), then a motherboard that fits, then Set up.
// Any GPU works with any CPU, so pairs get a balance badge; boards are filtered by the CPU's socket.
import { useEffect, useMemo, useState } from "react";
import type { Catalog } from "./hooks";
import { boardsFor, pairing, psuFor, type Match } from "../data/perf";

export interface Build {
  gpu: string;
  cpu: string;
  board: string;
}
type Step = "gpu" | "cpu" | "board";

const MATCH: Record<Match, string> = { balanced: "Balanced", good: "Good match", "cpu-limited": "CPU-limited" };

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

  return (
    <div className="pcd" data-open={open || undefined} aria-hidden={!open}>
      <div className="pcd-scrim" onClick={onClose} />
      <aside className="pcd-panel" role="dialog" aria-label="Build your PC" aria-modal="true">
        <header className="pcd-head">
          <div>
            <p className="pcd-kicker">Build</p>
            <h2 className="pcd-title">Choose your parts</h2>
          </div>
          <button type="button" className="pcd-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <nav className="pcd-steps" role="tablist">
          {(
            [
              ["gpu", "Graphics", gpu?.name.replace(/^GeForce |^Radeon /, "")],
              ["cpu", "Processor", cpu?.name.replace(/^Core /, "")],
              ["board", "Motherboard", board?.chipset.replace(/^(Intel|AMD) /, "")],
            ] as [Step, string, string | undefined][]
          ).map(([id, label, value], i) => (
            <button key={id} type="button" role="tab" aria-selected={step === id} className="pcd-step" disabled={id === "board" && !cpu} onClick={() => setStep(id)}>
              <span className="pcd-step-n">{i + 1}</span>
              <span className="pcd-step-l">{label}</span>
              <span className="pcd-step-v">{value ?? "—"}</span>
            </button>
          ))}
        </nav>

        <div className="pcd-list" role="listbox" aria-label={step}>
          {!catalog && <p className="pcd-empty">Loading parts…</p>}
          {catalog && step === "gpu" &&
            catalog.gpus.map((g) => {
              const fit = cpu ? pairing(g, cpu) : null;
              return (
                <button key={g.id} type="button" role="option" aria-selected={draft.gpu === g.id} className="pcd-row" onClick={() => setDraft((d) => ({ ...d, gpu: g.id }))}>
                  <span className="pcd-row-main">
                    <span className="pcd-brand">{g.brand}</span>
                    <strong>{g.name}</strong>
                    <span className="pcd-spec">
                      {g.vram} GB {g.memType} · {g.power} W · {Math.round(g.avg["1440p"])} FPS avg 1440p
                    </span>
                  </span>
                  {fit && <span className="pcd-badge" data-match={fit.match} title={fit.note}>{MATCH[fit.match]}</span>}
                </button>
              );
            })}
          {catalog && step === "cpu" &&
            catalog.cpus.map((c) => {
              const fit = gpu ? pairing(gpu, c) : null;
              return (
                <button key={c.id} type="button" role="option" aria-selected={draft.cpu === c.id} className="pcd-row" onClick={() => pickCpu(c.id)}>
                  <span className="pcd-row-main">
                    <span className="pcd-brand">
                      {c.brand} · {c.socket}
                    </span>
                    <strong>{c.name}</strong>
                    <span className="pcd-spec">
                      {c.cores} cores{c.eCores ? ` (${c.pCores}P + ${c.eCores}E)` : ""} · {c.boost} GHz · {Math.round(c.gaming * 100)}% gaming
                    </span>
                  </span>
                  {fit && <span className="pcd-badge" data-match={fit.match} title={fit.note}>{MATCH[fit.match]}</span>}
                </button>
              );
            })}
          {catalog && step === "board" && (
            <>
              {cpu && <p className="pcd-note">Showing {cpu.socket} boards — the socket the {cpu.name} needs.</p>}
              {boards.map((b) => (
                <button key={b.id} type="button" role="option" aria-selected={draft.board === b.id} className="pcd-row" onClick={() => setDraft((d) => ({ ...d, board: b.id }))}>
                  <span className="pcd-row-main">
                    <span className="pcd-brand">{b.tier === "best" ? "High-end" : "Value"}</span>
                    <strong>{b.chipset} · ATX</strong>
                    <span className="pcd-spec">
                      {b.gpuSlot} · M.2 {b.m2} · {b.oc}
                    </span>
                    <span className="pcd-reason">{b.reason}</span>
                  </span>
                  {b.recommended && <span className="pcd-badge" data-match="balanced">Recommended</span>}
                </button>
              ))}
            </>
          )}
        </div>

        <footer className="pcd-foot">
          {gpu && cpu && (
            <p className="pcd-summary">
              {pairing(gpu, cpu).note}. {psuFor(gpu) > 850 ? `Power supply upgraded to ${psuFor(gpu)} W for the ${gpu.name}.` : "850 W power supply is enough."}
            </p>
          )}
          <div className="pcd-actions">
            {step !== "board" ? (
              <button type="button" className="pcd-next" disabled={step === "gpu" ? !gpu : !cpu} onClick={() => setStep(step === "gpu" ? "cpu" : "board")}>
                Next
              </button>
            ) : null}
            <button type="button" className="pcd-go" disabled={!ready} onClick={() => ready && onSetup({ gpu: gpu!.id, cpu: cpu!.id, board: board!.id })}>
              Set up &amp; power on
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
