"use client";
// Small controls for the running panel: a segmented control with a sliding thumb, and a switch.
import { useId, useRef } from "react";
import { cx, FOCUS } from "./tw";

/** Equal-width options with a white thumb that slides to the chosen one. Arrow keys move the choice. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  kind = "radio",
  size = "md",
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  kind?: "radio" | "tab";
  size?: "md" | "sm";
}) {
  const id = useId();
  const group = useRef<HTMLDivElement>(null);
  const index = Math.max(0, options.findIndex(([v]) => v === value));
  const n = options.length;
  const move = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + n) % n;
    onChange(options[next][0]);
    (group.current?.children[next + 1] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {kind === "radio" && (
        <span id={id} className="text-[11px] text-neutral-400">
          {label}
        </span>
      )}
      <div
        ref={group}
        role={kind === "tab" ? "tablist" : "radiogroup"}
        aria-labelledby={kind === "radio" ? id : undefined}
        aria-label={kind === "tab" ? label : undefined}
        onKeyDown={move}
        className={cx("relative grid bg-neutral-100 p-0.75", size === "md" ? "rounded-xl" : "rounded-[10px]")}
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className={cx("absolute inset-y-0.75 left-0.75 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]", size === "md" ? "rounded-[9px]" : "rounded-lg")}
          style={{ width: `calc((100% - 6px) / ${n})`, transform: `translateX(${index * 100}%)` }}
        />
        {options.map(([v, l]) => {
          const on = v === value;
          return (
            <button
              key={v}
              type="button"
              role={kind}
              aria-checked={kind === "radio" ? on : undefined}
              aria-selected={kind === "tab" ? on : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(v)}
              className={cx(
                "relative z-1 cursor-pointer truncate rounded-[9px] px-1 text-center transition-colors duration-200",
                size === "md" ? "py-1.75 text-[12px]" : "py-1.5 text-[11.5px]",
                on ? "font-medium text-neutral-950" : "text-neutral-500 hover:text-neutral-950",
                FOCUS,
              )}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cx(
        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border pl-2.25 pr-3 text-[12px] transition-colors duration-200",
        on ? "border-neutral-950" : "border-neutral-200 hover:border-neutral-300",
        FOCUS,
      )}
    >
      <span className={cx("relative h-3.5 w-6 rounded-full transition-colors duration-200", on ? "bg-neutral-950" : "bg-neutral-300")}>
        <span className={cx("absolute left-0.5 top-0.5 size-2.5 rounded-full bg-white transition-transform duration-200", on && "translate-x-2.5")} />
      </span>
      {children}
    </button>
  );
}
