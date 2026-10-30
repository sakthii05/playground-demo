"use client";
// Spotify's top 10 of all time as a carousel of albums. Browse with the wheel, arrows or a swipe; the
// centre album opens on click: the rest leave, it comes to the front, its cover swings open, the disc
// lifts out and the song plays. Clicking the open cover shuts it (the song keeps playing); next and
// previous slide the next album in from the side it belongs on.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion } from "motion/react";
import { TRACKS, type Track } from "./data/tracks";
import { wrap, type CaseState, type Live, type Mode } from "./scene/live";
import type { IntroPhase } from "./scene/Intro";
import { Player } from "./ui/Player";
import { Lyrics } from "./ui/Lyrics";
import { useLyrics } from "./ui/lrc";
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

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
/** Screen pixels between neighbouring albums in the carousel, matching the 3D layout. */
const albumPx = () => {
  const w = innerWidth;
  const h = innerHeight;
  return w / h < 0.9 ? 0.98 * Math.min(h * 0.32, w * 0.58) : 1.17 * Math.min(h * 0.38, w / 5.8);
};

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
  const [flipped, setFlipped] = useState(false);
  // lyrics on the open lid's page, for this song: switched off again whenever the song changes
  const [lyricsOn, setLyricsOn] = useState(false);
  const [narrow, setNarrow] = useState(false);
  // the intro (drawn in the scene): `warm` while the 3D warms up behind it; `phase` as it plays out
  const [warm, setWarm] = useState(true);
  const [phase, setPhase] = useState<IntroPhase>("loading");
  // a plain black cover from the very first paint until the 3D black screen has drawn (the canvas
  // loads a moment after the page), so nothing of the page shows before the intro
  const [covered, setCovered] = useState(true);
  const onReady = useCallback(() => setWarm(false), []);
  const onPhase = useCallback((p: IntroPhase) => {
    if (p === "drawn") return setCovered(false);
    setPhase(p);
    if (p === "done") {
      // the page is yours once the black screen has gone (the ball is still on its way up)
      introDone.current = true;
      lastInput.current = performance.now();
    }
  }, []);
  const logoSlot = useRef<HTMLSpanElement>(null);
  const busyRef = useRef(false);
  const lastInput = useRef(0);
  const introDone = useRef(false);
  const drag = useRef<{ id: number; x: number; y: number; from: number; moved: boolean; lx: number; lt: number; v: number } | null>(null);
  const wheel = useRef({ stepped: 0, snap: 0 as ReturnType<typeof setTimeout> | 0 });
  const front = useRef<gsap.core.Timeline | null>(null);
  const sleeve = useRef<gsap.core.Timeline | null>(null);

  const live = useRef<Live>({
    pos: 0,
    target: 0,
    mode: "browse",
    caseState: "closed",
    anim: { fly: 0, rise: 0, hinge: 0, lift: 0, flip: 0 },
    swap: { from: -1, dir: 1, t: 0 },
    hover: { on: false, x: 0, y: 0 },
    disc: { hover: false, drag: false, yaw: 0, pitch: 0, vYaw: 0, spin: 0, z: 0, back: 0 },
    playing: false,
    pointer: { x: 0, y: 0 },
    steer: 0,
    fronts: new Set(),
    detailReady: null,
    intro: { target: 0 },
    logoSlot: null,
    lyrics: false,
    page: { on: false, x: 0, y: 0, w: 0, h: 0 },
    open: () => {},
    toggleCase: () => {},
    turnOver: () => {},
  });
  const track = TRACKS[active];
  // when a clip plays to its end, the next song follows on its own, unless the visitor does
  // something in the moment before (see the effect after `skip`)
  const endedRef = useRef<() => void>(() => {});
  const player = usePlayer(track, () => endedRef.current());
  const cover = useCover(track);
  const lyrics = useLyrics(track);
  // the lyrics read the clock every frame, through a stable function (the player's own changes)
  const readTime = useCallback(() => playerRef.current.time(), []);
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

  /** The page shows the album nearest the carousel's target (no re-render while that stays the same). */
  const sync = useCallback(() => {
    const i = wrap(Math.round(live.current.target), N);
    setActive((was) => (was === i ? was : i));
  }, []);

  const step = useCallback(
    (d: number, byUser = true) => {
      const s = live.current;
      if (s.mode !== "browse" || !introDone.current) return;
      if (byUser) lastInput.current = performance.now();
      s.target = Math.round(s.target) + d;
      s.hover.on = false;
      sync();
    },
    [sync],
  );

  /**
   * Trackpad scrolling and dragging move the carousel directly, a fraction of an album at a time,
   * with the carousel following tightly; letting go settles it on the nearest album.
   */
  const steerBy = useCallback(
    (albums: number) => {
      const s = live.current;
      if (s.mode !== "browse" || !introDone.current) return;
      const now = performance.now();
      lastInput.current = now;
      s.steer = now + 220;
      s.target += albums;
      s.hover.on = false;
      sync();
    },
    [sync],
  );
  const settle = useCallback(
    (lean = 0) => {
      const s = live.current;
      s.target = Math.round(s.target + lean);
      sync();
    },
    [sync],
  );

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
  /**
   * Resolves once the disc sits label up and level on its hub and the sleeve is back in under it
   * (the disc homes itself while the lid is closing; this never waits more than 1.5 s).
   */
  const discHome = () =>
    new Promise<void>((done) => {
      const t0 = performance.now();
      const turn = Math.PI * 2;
      const check = () => {
        const d = live.current.disc;
        const off = Math.abs(d.yaw - Math.round(d.yaw / turn) * turn);
        if ((off < 0.01 && Math.abs(d.pitch) < 0.01 && d.back < 0.005) || reduced() || performance.now() - t0 > 1500) {
          // exactly home (a whole number of turns is the same as none)
          d.yaw = 0;
          d.pitch = 0;
          return done();
        }
        requestAnimationFrame(check);
      };
      check();
    });

  /**
   * Waits (a frame at a time, at most `limit` ms) until the chosen album's art is on, so a lid never
   * opens on art still being made. Thanks to the warm-up and the prefetch it is nearly always on already.
   */
  const artReady = useCallback((limit = 2500) => {
    const slug = TRACKS[wrap(Math.round(live.current.target), N)].slug;
    const t0 = performance.now();
    return new Promise<void>((done) => {
      const check = () => (live.current.detailReady === slug || performance.now() - t0 > limit ? done() : requestAnimationFrame(check));
      check();
    });
  }, []);

  const openCase = useCallback(async () => {
    await artReady();
    setCase("opening");
    await run(sleeve.current, true);
    setCase("open");
  }, [setCase, artReady]);

  /**
   * Shuts the lid. The disc goes home first: wherever it was turned to, it settles label up and level
   * on its hub, and the sleeve comes back in under it; only then does the lid close over it.
   */
  const closeCase = useCallback(async () => {
    resetDisc();
    setCase("closing");
    await discHome();
    await run(sleeve.current, false, 1.3);
    setCase("closed");
  }, [setCase]);

  /** Turns the shut case over to its back (1) or back to its front (0), as you would to read it. */
  const turn = useCallback(async (to: 0 | 1) => {
    const a = live.current.anim;
    if (a.flip !== to) {
      if (reduced()) a.flip = to;
      else await gsap.to(a, { flip: to, duration: 1.2, ease: "power3.inOut" });
    }
    setFlipped(to === 1);
  }, []);

  const open = useCallback(async () => {
    if (busyRef.current || live.current.mode !== "browse" || !introDone.current) return;
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
    await turn(0);
    setMode("closing");
    await run(front.current, false, 1.5);
    setMode("browse");
    lastInput.current = performance.now();
    setBusy(false);
  }, [setBusy, setMode, closeCase, turn]);

  /** Shut the open cover (the song plays on), or open a shut one (turning it face up first). */
  const toggleCase = useCallback(async () => {
    if (busyRef.current || live.current.mode !== "open") return;
    setBusy(true);
    if (live.current.caseState === "open") await closeCase();
    else if (live.current.caseState === "closed") {
      await turn(0);
      await openCase();
    }
    setBusy(false);
  }, [setBusy, openCase, closeCase, turn]);

  /** The rotate button: shut the lid if it is open (the song plays on), then turn the case over, or back. */
  const turnOver = useCallback(async () => {
    if (busyRef.current || live.current.mode !== "open") return;
    setBusy(true);
    if (live.current.caseState === "open") await closeCase();
    await turn(live.current.anim.flip > 0.5 ? 0 : 1);
    setBusy(false);
  }, [setBusy, closeCase, turn]);

  /** Next / previous at the front: stop, shut the cover if open, slide the albums, open the new one the same way and play. */
  const skip = useCallback(
    async (dir: 1 | -1) => {
      const s = live.current;
      if (busyRef.current || s.mode !== "open") return;
      setBusy(true);
      playerRef.current.stop();
      const wasOpen = s.caseState === "open";
      if (wasOpen) await closeCase();
      await turn(0);
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
    [setBusy, openCase, closeCase, turn],
  );

  live.current.open = open;
  live.current.toggleCase = toggleCase;
  live.current.turnOver = turnOver;
  live.current.lyrics = lyricsOn;
  // a new song starts with its lyrics off (the visitor turns them on for the songs they want)
  useEffect(() => {
    live.current.lyrics = false;
    setLyricsOn(false);
  }, [active]);

  // autoplay: when a clip ends, wait a moment; any click, tap, key or scroll in that moment means the
  // visitor is doing something, so nothing moves. Otherwise the next song slides in and plays.
  useEffect(() => {
    let timer = 0 as ReturnType<typeof setTimeout> | 0;
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = 0;
      removeEventListener("pointerdown", cancel, true);
      removeEventListener("keydown", cancel, true);
      removeEventListener("wheel", cancel, true);
    };
    endedRef.current = () => {
      if (live.current.mode !== "open" || busyRef.current) return;
      cancel();
      addEventListener("pointerdown", cancel, true);
      addEventListener("keydown", cancel, true);
      addEventListener("wheel", cancel, true);
      timer = setTimeout(() => {
        cancel();
        if (live.current.mode === "open" && !busyRef.current && !playerRef.current.playing) skip(1);
      }, 1500);
    };
    return cancel;
  }, [skip]);

  /** The mic button: lyrics on (opening the lid if it is shut, since they print on its page) or off. */
  const switchLyrics = useCallback(() => {
    const on = !live.current.lyrics;
    live.current.lyrics = on;
    setLyricsOn(on);
    if (on && live.current.caseState === "closed") toggleCase();
  }, [toggleCase]);
  // moves on by itself while nobody is using it
  useEffect(() => {
    const id = setInterval(() => {
      const s = live.current;
      if (s.mode !== "browse" || s.hover.on || drag.current || document.hidden || reduced() || !introDone.current) return;
      if (performance.now() - lastInput.current < IDLE_MS) return;
      step(1, false);
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the seek bar uses the arrow keys itself (they must not skip songs there)
      if (e.target instanceof HTMLElement && e.target.getAttribute("role") === "slider") return;
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

  // where the logo slot is, for the ball to fly to (kept current on resize)
  useEffect(() => {
    const measure = () => {
      const el = logoSlot.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      live.current.logoSlot = { x: b.left + b.width / 2, y: b.top + b.height / 2, size: b.width };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (logoSlot.current) ro.observe(logoSlot.current);
    addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const mq = matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const endDrag = (id: number) => {
    const d = drag.current;
    if (!d || d.id !== id) return;
    drag.current = null;
    // a flick carries on to the next album
    if (d.moved) settle(Math.abs(d.v) > 0.45 ? -Math.sign(d.v) * 0.5 : 0);
  };

  const browsing = mode === "browse";
  const atFront = mode === "open" || mode === "opening";

  return (
    <div
      data-sth
      className={cx(
        SANS,
        "relative h-dvh w-full touch-none select-none overflow-clip text-white",
      )}
      style={{ background: C.base }}
      onPointerMove={(e) => {
        live.current.pointer = {
          x: (e.clientX / innerWidth) * 2 - 1,
          y: 1 - (e.clientY / innerHeight) * 2,
        };
        const d = drag.current;
        if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x;
        if (!d.moved) {
          // a drag starts once it is clearly sideways; until then it may still be a click
          if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(e.clientY - d.y))
            return;
          d.moved = true;
        }
        const now = performance.now();
        d.v = d.v * 0.7 + ((e.clientX - d.lx) / Math.max(1, now - d.lt)) * 0.3;
        d.lx = e.clientX;
        d.lt = now;
        steerBy(d.from - dx / albumPx() - live.current.target);
      }}
      onPointerDown={(e) => {
        if (live.current.mode !== "browse" || e.button !== 0) return;
        const now = performance.now();
        drag.current = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          from: live.current.target,
          moved: false,
          lx: e.clientX,
          lt: now,
          v: 0,
        };
      }}
      onPointerUp={(e) => endDrag(e.pointerId)}
      onPointerCancel={(e) => endDrag(e.pointerId)}
      onPointerLeave={(e) => endDrag(e.pointerId)}
      onWheel={(e) => {
        if (live.current.mode !== "browse") return;
        const w = wheel.current;
        const delta =
          Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        // a mouse wheel clicks in whole notches: one album each. A trackpad sends a stream of small
        // deltas (with momentum): those move the carousel directly and it settles when they stop.
        const notch =
          e.deltaMode === 1 ||
          (e.deltaX === 0 &&
            Math.abs(e.deltaY) >= 50 &&
            Number.isInteger(e.deltaY));
        if (notch) {
          const now = performance.now();
          if (now - w.stepped > 120) step(Math.sign(delta));
          w.stepped = now;
          return;
        }
        steerBy(clamp(delta / (albumPx() * 1.4), -0.35, 0.35));
        if (w.snap) clearTimeout(w.snap);
        w.snap = setTimeout(() => settle(), 140);
      }}
    >
      {/* the album's colour, soft behind the albums; stronger once one is at the front */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-[background-color,opacity] duration-1000 ease-out"
        style={{
          backgroundColor: track.color,
          opacity: atFront ? 0.55 : 0.3,
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 48%, #000 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 48%, #000 0%, transparent 75%)",
        }}
      />
      <Backdrop cover={cover} show={atFront} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(18,18,18,0.6),transparent_30%,transparent_65%,rgba(18,18,18,0.85))]"
      />

      <div className="absolute inset-0">
        <Scene
          live={live}
          tracks={TRACKS}
          active={active}
          open={mode !== "browse"}
          warm={warm}
          onReady={onReady}
          onPhase={onPhase}
        />
      </div>

      {covered && (
        <div
          aria-hidden
          className="absolute inset-0 z-30"
          style={{ background: C.base }}
        />
      )}

      {/* overlay: hidden while the intro's black screen is up, fading in as it crumbles away */}
      <div
        className={cx(
          "pointer-events-none absolute inset-0 transition-opacity duration-1400 ease-out",
          phase === "loading" ? "opacity-0" : "opacity-100",
        )}
      >
        <header
          className={cx(
            GUTTER,
            "flex items-center justify-between pt-[clamp(14px,2.6vh,28px)]",
          )}
        >
          <div className="flex items-center gap-2.5">
            {/* left empty: the intro's disco ball flies here and stays, turning */}
            <span ref={logoSlot} className="block size-9" aria-hidden />
            <div className="leading-tight">
              <p className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em]">
                Top Hits
                {/* text-box trims the line to the capitals, so the padding is the same on every side */}
                <span
                  className={cx(
                    MONO,
                    "rounded-full border border-white/20 p-1.5 text-[9px] font-medium uppercase leading-none tracking-[0.08em] text-white/70 [text-box:trim-both_cap_alphabetic]",
                  )}
                >
                  Fan concept 2026
                </span>
              </p>
              <p className="text-[11px]" style={{ color: C.subdued }}>
                Most streamed of all time
              </p>
            </div>
          </div>
          <div className="flex items-end gap-4">
            <p className="text-[11px] hidden md:block" style={{ color: C.subdued }}>
              Created by{" "}
              <a
                href="https://sakthi-portfolio-mauve.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className={cx(
                  "pointer-events-auto font-semibold transition-colors hover:underline",
                  FOCUS,
                )}
                style={{ color: C.green }}
              >
                @sakthi
              </a>
            </p>
            <p className={cx(MONO, "text-[12px]")} style={{ color: C.subdued }}>
              <span className="text-white">
                {String(active + 1).padStart(2, "0")}
              </span>{" "}
              / {String(N).padStart(2, "0")}
            </p>
          </div>
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
          <button
            type="button"
            onClick={open}
            className={cx(
              "pointer-events-auto sr-only focus:not-sr-only focus:absolute focus:left-1/2 focus:top-1/2 focus:-translate-x-1/2 focus:rounded-full focus:bg-black focus:px-4 focus:py-2",
              FOCUS,
            )}
          >
            Open {track.title}
          </button>
        )}

        {atFront && (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className={cx(
              GUTTER,
              "pointer-events-auto absolute left-0 top-[clamp(64px,10vh,96px)] flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-white/80 transition-colors hover:text-white disabled:cursor-default disabled:opacity-50",
              FOCUS,
            )}
          >
            <svg
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <path
                d="M10 3 5 8l5 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden md:inline">Back to the top 10</span>
            <span
              className={cx(
                MONO,
                "hidden rounded border border-white/15 px-1.5 py-px text-[10px] text-white/50 sm:inline",
              )}
            >
              Esc
            </span>
          </button>
        )}
        {mode === "open" && !busy && (
          <p
            className={cx(
              MONO,
              "absolute inset-x-0 top-[clamp(64px,10vh,96px)] hidden text-center text-[11px] text-white/45 sm:block",
            )}
          >
            {flipped
              ? "The back of the case · click it to turn it back"
              : caseState === "open"
                ? "Drag the disc · click the lid to shut it"
                : "Click the case to open it"}
          </p>
        )}

        <AnimatePresence>
          {mode === "open" && lyricsOn && lyrics?.length ? (
            <Lyrics
              key={track.slug}
              live={live}
              lines={lyrics}
              color={track.color}
              time={readTime}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {mode === "open" && (
            <TurnButton
              key="turn"
              flipped={flipped}
              disabled={busy}
              onClick={turnOver}
            />
          )}
          {mode === "open" && (
            <Player
              key="player"
              track={track}
              playing={player.playing}
              elapsed={player.elapsed}
              duration={player.duration}
              busy={busy}
              onToggle={player.toggle}
              onSkip={skip}
              onSeek={player.seek}
              cover={cover}
              lyrics={lyricsOn}
              hasLyrics={!!lyrics?.length}
              onLyrics={switchLyrics}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Behind the chosen album, the page takes on its front cover, softly blurred: it fades and settles in
 * as the album comes forward, and crossfades when next / previous changes the album.
 */
/**
 * The album's front cover as a small image (its front.webp, or the drawn cover when it has none), for
 * the player's picture and the page behind the open album. Made once per album and cached.
 */
function useCover(track: Track) {
  const [cover, setCover] = useState<{ slug: string; url: string } | null>(null);
  useEffect(() => {
    let alive = true;
    // the textures module brings three.js with it, so it loads with the scene, not the page
    import("./scene/textures").then((m) => m.frontBackdrop(track)).then((url) => alive && setCover({ slug: track.slug, url }));
    return () => {
      alive = false;
    };
  }, [track]);
  return cover?.slug === track.slug ? cover.url : null;
}

function Backdrop({ cover, show }: { cover: string | null; show: boolean }) {
  const url = cover;
  return (
    <AnimatePresence>
      {show && url && (
        <motion.div
          key={url}
          aria-hidden
          initial={{ opacity: 0, scale: 1.22 }}
          animate={{ opacity: 0.85, scale: 1.1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${url})`, filter: "blur(22px) saturate(1.15) brightness(0.8)" }}
        />
      )}
    </AnimatePresence>
  );
}

/** Sits just above the player: turns the case over to show its back, and back again. */
function TurnButton({ flipped, disabled, onClick }: { flipped: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={flipped ? "Turn the case to the front" : "Turn the case over"}
      title={flipped ? "Show the front" : "Show the back"}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      className={cx(
        // just above the player's left edge (lined up with it), clear of the album on any screen
        "pointer-events-auto absolute bottom-[calc(clamp(14px,3.5vh,36px)+104px)] sm:bottom-[calc(clamp(14px,3.5vh,36px)+118px)] left-[max(16px,calc(50%-340px))] grid size-10 cursor-pointer place-items-center rounded-full text-white/80 transition hover:scale-110 hover:text-white disabled:cursor-default disabled:opacity-40",
        FOCUS,
      )}
    >
      <svg viewBox="0 0 24 24" className={cx("size-5 transition-transform duration-500", flipped && "-scale-x-100")} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* an arrow round a vertical axis: a turn about the upright */}
        <ellipse cx="12" cy="12" rx="9" ry="3.6" opacity="0.35" />
        <path d="M3.6 13.6C4.9 15.4 8.2 16.6 12 16.6c4.7 0 8.6-2 9-4.6" />
        <path d="m18.6 14.9 2.6-2.9 1.1 3.6" />
        <path d="M12 3v18" opacity="0.5" />
      </svg>
    </motion.button>
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
