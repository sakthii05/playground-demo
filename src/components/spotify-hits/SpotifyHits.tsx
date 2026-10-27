"use client";
// Spotify's top 10 of all time as a carousel of albums. Browse with the wheel, arrows or a swipe; the
// centre album opens on click: the rest leave, it comes to the front, its cover swings open, the disc
// lifts out and the song plays. Clicking the open cover shuts it (the song keeps playing); next and
// previous slide the next album in from the side it belongs on.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AnimatePresence } from "motion/react";
import { TRACKS, fileUrl } from "./data/tracks";
import { wrap, type CaseState, type Live, type Mode } from "./scene/live";
import { Player } from "./ui/Player";
import { TrackHeading, TrackMeta } from "./ui/TrackInfo";
import { usePlayer } from "./ui/usePlayer";
import { C, FOCUS, GUTTER, MONO, SANS, cx } from "./ui/tw";

gsap.registerPlugin(useGSAP);

const Scene = dynamic(() => import("./scene/Scene"), { ssr: false, loading: () => null });

const N = TRACKS.length;
const AUTO_MS = 4500; // the carousel moves on by itself this often…
const IDLE_MS = 7000; // …once the visitor has left it alone this long
// the same breakpoint the 3D layout uses (viewport narrower than 0.9 × its height)
const NARROW = "(max-aspect-ratio: 9/10)";

const reduced = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays a timeline forward or back and resolves when it gets there. */
function run(tl: gsap.core.Timeline | null, forward: boolean, speed = 1) {
  return new Promise<void>((done) => {
    if (!tl) return done();
    if (reduced() || tl.progress() === (forward ? 1 : 0)) {
      tl.progress(forward ? 1 : 0).pause();
      return done();
    }
    tl.eventCallback(forward ? "onComplete" : "onReverseComplete", () => done());
    tl.timeScale(speed);
    if (forward) tl.play();
    else tl.reverse();
  });
}

export default function SpotifyHits() {
  const [active, setActive] = useState(0);
  const [mode, setModeState] = useState<Mode>("browse");
  const [caseState, setCaseState] = useState<CaseState>("closed");
  const [busy, setBusyState] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const busyRef = useRef(false);
  const lastInput = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const wheel = useRef({ sum: 0, last: 0, stepped: 0 });
  const front = useRef<gsap.core.Timeline | null>(null);
  const sleeve = useRef<gsap.core.Timeline | null>(null);

  const live = useRef<Live>({
    pos: 0,
    target: 0,
    mode: "browse",
    caseState: "closed",
    anim: { fly: 0, rise: 0, hinge: 0, lift: 0 },
    swap: { from: -1, dir: 1, t: 0 },
    hover: { on: false, x: 0, y: 0 },
    disc: { hover: false, drag: false, yaw: 0, pitch: 0, vYaw: 0, spin: 0, z: 0 },
    playing: false,
    pointer: { x: 0, y: 0 },
    open: () => {},
    toggleCase: () => {},
  });
  const track = TRACKS[active];
  const player = usePlayer(track);
  // the flows below await animations, so they reach the player through a ref to get the current track's
  const playerRef = useRef(player);
  playerRef.current = player;
  live.current.playing = player.playing;

  const setMode = useCallback((m: Mode) => {
    live.current.mode = m;
    setModeState(m);
  }, []);
  const setCase = useCallback((c: CaseState) => {
    live.current.caseState = c;
    setCaseState(c);
  }, []);
  const setBusy = useCallback((b: boolean) => {
    busyRef.current = b;
    setBusyState(b);
  }, []);

  const step = useCallback((d: number, byUser = true) => {
    const s = live.current;
    if (s.mode !== "browse") return;
    if (byUser) lastInput.current = performance.now();
    s.target += d;
    s.hover.on = false;
    setActive(wrap(Math.round(s.target), N));
  }, []);

  // two timelines: bringing the album to the front, and opening its sleeve
  useGSAP(() => {
    const a = live.current.anim;
    front.current = gsap
      .timeline({ paused: true })
      .to(a, { fly: 1, duration: 1.2, ease: "power3.in" }, 0)
      .to(a, { rise: 1, duration: 1.6, ease: "power3.inOut" }, 0.25);
    sleeve.current = gsap
      .timeline({ paused: true })
      .to(a, { hinge: 1, duration: 1.6, ease: "power2.inOut" }, 0)
      .to(a, { lift: 1, duration: 1.0, ease: "back.out(1.4)" }, 1.35);
  });

  const resetDisc = () => {
    Object.assign(live.current.disc, { hover: false, drag: false, vYaw: 0 });
    document.body.style.cursor = "";
  };

  const openCase = useCallback(async () => {
    setCase("opening");
    await run(sleeve.current, true);
    setCase("open");
  }, [setCase]);

  const closeCase = useCallback(async () => {
    resetDisc();
    setCase("closing");
    await run(sleeve.current, false, 1.3);
    setCase("closed");
  }, [setCase]);

  const open = useCallback(async () => {
    if (busyRef.current || live.current.mode !== "browse") return;
    setBusy(true);
    setMode("opening");
    await run(front.current, true);
    setMode("open");
    await openCase();
    playerRef.current.play();
    setBusy(false);
  }, [setBusy, setMode, openCase]);

  const back = useCallback(async () => {
    if (busyRef.current || live.current.mode !== "open") return;
    setBusy(true);
    playerRef.current.stop();
    if (live.current.caseState !== "closed") await closeCase();
    setMode("closing");
    await run(front.current, false, 1.5);
    setMode("browse");
    lastInput.current = performance.now();
    setBusy(false);
  }, [setBusy, setMode, closeCase]);

  /** Shut the open cover (the song plays on), or open a shut one. */
  const toggleCase = useCallback(async () => {
    if (busyRef.current || live.current.mode !== "open") return;
    setBusy(true);
    if (live.current.caseState === "open") await closeCase();
    else if (live.current.caseState === "closed") await openCase();
    setBusy(false);
  }, [setBusy, openCase, closeCase]);

  /** Next / previous at the front: stop, shut the cover if open, slide the albums, open the new one the same way and play. */
  const skip = useCallback(
    async (dir: 1 | -1) => {
      const s = live.current;
      if (busyRef.current || s.mode !== "open") return;
      setBusy(true);
      playerRef.current.stop();
      const wasOpen = s.caseState === "open";
      if (wasOpen) await closeCase();
      s.swap = { from: wrap(Math.round(s.target), N), dir, t: 0 };
      s.target += dir;
      s.pos = s.target;
      Object.assign(s.disc, { yaw: 0, pitch: 0, spin: 0 });
      setActive(wrap(Math.round(s.target), N));
      if (!reduced()) await gsap.to(s.swap, { t: 1, duration: 1.3, ease: "none" });
      s.swap = { from: -1, dir, t: 0 };
      if (wasOpen) await openCase();
      playerRef.current.play();
      setBusy(false);
    },
    [setBusy, openCase, closeCase],
  );

  live.current.open = open;
  live.current.toggleCase = toggleCase;
  // moves on by itself while nobody is using it
  useEffect(() => {
    const id = setInterval(() => {
      const s = live.current;
      if (s.mode !== "browse" || s.hover.on || document.hidden || reduced()) return;
      if (performance.now() - lastInput.current < IDLE_MS) return;
      step(1, false);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = live.current.mode;
      const onButton = e.target instanceof HTMLButtonElement;
      if (e.key === "Escape") back();
      else if (m === "browse") {
        if (e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowLeft") step(-1);
        else if (e.key === "Enter" && !onButton) open();
      } else if (m === "open") {
        if (e.key === "ArrowRight") skip(1);
        else if (e.key === "ArrowLeft") skip(-1);
        else if (e.key === " " && !onButton) {
          e.preventDefault();
          playerRef.current.toggle();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, open, back, skip]);

  useEffect(() => {
    const mq = matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const browsing = mode === "browse";
  const atFront = mode === "open" || mode === "opening";

  return (
    <div
      data-sth
      className={cx(SANS, "relative h-dvh w-full touch-none select-none overflow-hidden text-white")}
      style={{ background: C.base }}
      onPointerMove={(e) => {
        live.current.pointer = { x: (e.clientX / innerWidth) * 2 - 1, y: 1 - (e.clientY / innerHeight) * 2 };
      }}
      onWheel={(e) => {
        // one album per wheel gesture: add up the deltas, step once past a threshold, then rest a moment
        const w = wheel.current;
        const now = performance.now();
        if (now - w.last > 250) w.sum = 0;
        w.last = now;
        w.sum += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (Math.abs(w.sum) > 40 && now - w.stepped > 450) {
          step(Math.sign(w.sum));
          w.sum = 0;
          w.stepped = now;
        }
      }}
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s || live.current.mode !== "browse") return;
        const dx = e.clientX - s.x;
        const dy = e.clientY - s.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
      }}
    >
      {/* the album's colour, soft behind the albums; stronger once one is at the front */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background-color,opacity] duration-1000 ease-out"
        style={{
          backgroundColor: track.color,
          opacity: atFront ? 0.55 : 0.3,
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 48%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 48%, #000 0%, transparent 75%)",
        }}
      />
      {/* with a real front cover, the page takes on the cover itself, blurred */}
      {track.files.front && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[-10%] bg-cover bg-center blur-[70px] saturate-150 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${fileUrl(track, "front.webp")})`, opacity: atFront ? 0.6 : 0 }}
        />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(18,18,18,0.6),transparent_30%,transparent_65%,rgba(18,18,18,0.85))]" />

      <div className="absolute inset-0">
        <Scene live={live} tracks={TRACKS} active={active} />
      </div>

      {/* overlay */}
      <div className="pointer-events-none absolute inset-0">
        <header className={cx(GUTTER, "flex items-center justify-between pt-[clamp(14px,2.6vh,28px)]")}>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full" style={{ background: C.green }} aria-hidden>
              <svg viewBox="0 0 16 16" className="size-4 text-black" fill="currentColor">
                <rect x="2.5" y="6" width="2.2" height="6" rx="1.1" />
                <rect x="6.9" y="3.5" width="2.2" height="9" rx="1.1" />
                <rect x="11.3" y="7.5" width="2.2" height="4.5" rx="1.1" />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-[-0.01em]">Top Hits</p>
              <p className="text-[11px]" style={{ color: C.subdued }}>
                Most streamed of all time
              </p>
            </div>
          </div>
          <p className={cx(MONO, "text-[12px]")} style={{ color: C.subdued }}>
            <span className="text-white">{String(active + 1).padStart(2, "0")}</span> / {String(N).padStart(2, "0")}
          </p>
        </header>

        <TrackHeading track={track} hidden={!browsing} />
        <TrackMeta track={track} hidden={!browsing} narrow={narrow} />

        {browsing && !narrow && (
          <>
            <Arrow side="left" onClick={() => step(-1)} />
            <Arrow side="right" onClick={() => step(1)} />
          </>
        )}
        {browsing && (
          <button type="button" onClick={open} className={cx("pointer-events-auto sr-only focus:not-sr-only focus:absolute focus:left-1/2 focus:top-1/2 focus:-translate-x-1/2 focus:rounded-full focus:bg-black focus:px-4 focus:py-2", FOCUS)}>
            Open {track.title}
          </button>
        )}

        {atFront && (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className={cx(GUTTER, "pointer-events-auto absolute left-0 top-[clamp(64px,10vh,96px)] flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-white/80 transition-colors hover:text-white disabled:cursor-default disabled:opacity-50", FOCUS)}
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to the top 10
            <span className={cx(MONO, "hidden rounded border border-white/15 px-1.5 py-px text-[10px] text-white/50 sm:inline")}>Esc</span>
          </button>
        )}
        {mode === "open" && !busy && (
          <p className={cx(MONO, "absolute inset-x-0 top-[clamp(64px,10vh,96px)] hidden text-center text-[11px] text-white/45 sm:block")}>
            {caseState === "open" ? "Drag the disc · click the cover to shut it" : "Click the cover to open it"}
          </p>
        )}

        <AnimatePresence>
          {mode === "open" && (
            <Player key="player" track={track} playing={player.playing} elapsed={player.elapsed} duration={player.duration} busy={busy} onToggle={player.toggle} onSkip={skip} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous song" : "Next song"}
      className={cx(
        "pointer-events-auto absolute top-1/2 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur transition hover:scale-105 hover:bg-black/60 hover:text-white",
        side === "left" ? "left-[clamp(12px,2vw,32px)]" : "right-[clamp(12px,2vw,32px)]",
        FOCUS,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d={side === "left" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
