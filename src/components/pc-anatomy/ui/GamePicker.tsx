"use client";
// The game picker: a listbox that opens under its button, each game a title and one line under it.
// Mouse, touch and keyboard (arrows, Home/End, Enter, Escape, first letter).
import { useEffect, useId, useRef, useState } from "react";
import type { Catalog } from "./hooks";
import { cx, FOCUS } from "./tw";

type GameOption = Catalog["games"][number];

export function GamePicker({ games, value, onChange }: { games: GameOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const current = games.find((g) => g.id === value) ?? games[0];

  const show = () => {
    setActive(Math.max(0, games.findIndex((g) => g.id === value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const choose = (i: number) => {
    onChange(games[i].id);
    close();
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  useEffect(() => {
    const el = open ? document.getElementById(`${id}-${active}`) : null;
    const box = list.current;
    if (!el || !box) return;
    // keep the active row in view inside the list only, never scroll the page
    if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop - 4;
    else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight + 4;
  }, [open, active, id]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = games.length - 1;
    if (e.key === "ArrowDown") setActive((a) => Math.min(last, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(last);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const order = [...games.slice(active + 1), ...games.slice(0, active + 1)];
      const hit = order.find((g) => g.name.toLowerCase().startsWith(k));
      if (hit) setActive(games.indexOf(hit));
    } else return;
    e.preventDefault();
  };

  if (!current) return null;
  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[11px] text-neutral-400">
        Game
      </span>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
        className={cx(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-white py-2 pl-3 pr-3 text-left transition-[border-color,box-shadow] duration-200",
          open ? "border-neutral-950 shadow-[0_0_0_3px_#f1f1f0]" : "border-neutral-200 hover:border-neutral-300",
          FOCUS,
        )}
      >
        <span className="min-w-0 flex-1">
          <span id={`${id}-value`} className="block truncate text-[13px] font-medium">
            {current.name}
          </span>
          <span className="block truncate text-[11px] text-neutral-400">{current.genre}</span>
        </span>
        <svg viewBox="0 0 16 16" className={cx("size-3.5 shrink-0 fill-none stroke-neutral-950 stroke-[1.6] transition-transform duration-300 [stroke-linecap:round] [stroke-linejoin:round]", open && "rotate-180")} aria-hidden>
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <ul
        ref={list}
        id={`${id}-list`}
        role="listbox"
        tabIndex={-1}
        aria-labelledby={`${id}-label`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={onListKey}
        inert={!open}
        className={cx(
          "absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-[min(340px,60svh)] origin-top overflow-auto overscroll-contain rounded-xl border border-neutral-200 bg-white p-1 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.35)] outline-none transition-[opacity,scale,translate] duration-200 ease-out scrollbar-thin",
          open ? "scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0",
        )}
      >
        {games.map((g, i) => {
          const on = g.id === value;
          return (
            <li
              key={g.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={on}
              onPointerMove={() => setActive(i)}
              onClick={() => choose(i)}
              className={cx("flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-150", i === active && "bg-neutral-100")}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{g.name}</span>
                <span className="block truncate text-[10.5px] text-neutral-400">{g.genre}</span>
              </span>
              <svg viewBox="0 0 16 16" className={cx("size-3.5 shrink-0 fill-none stroke-neutral-950 stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round]", on ? "opacity-100" : "opacity-0")} aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
