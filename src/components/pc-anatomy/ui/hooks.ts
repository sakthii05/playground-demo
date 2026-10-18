"use client";
// Data hooks for the overlay: the catalogue and profiles fetched from /api/pc, a live timeline that
// moves around the fetched steady state, and real numbers about the visitor's own device.
import { useEffect, useRef, useState } from "react";
import type { Board, Cpu, Gpu } from "../data/catalog";
import type { Profile } from "../data/perf";

export interface Catalog {
  gpus: Gpu[];
  cpus: Cpu[];
  boards: Board[];
  games: { id: string; name: string; genre: string; settings: string; source: string }[];
  sources: { label: string; detail: string; url: string }[];
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/pc/parts")
      .then((r) => r.json())
      .then((c) => alive && setCatalog(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}

export function useProfile(query: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!query) return;
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/pc/profile?${query}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d) => setProfile(d.profile))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query]);
  return { profile, loading };
}

export interface Sample {
  fps: number;
  cpu: number;
  gpu: number;
  ram: number;
  vram: number;
  cpuC: number;
  gpuC: number;
  watts: number;
  fan: number;
  cores: number[];
}
const N = 60;
const noise = (amp: number) => (Math.random() * 2 - 1) * amp;

/** A sample every 500 ms: each value eases toward the profile and wanders a little, with the odd frame dip. */
export function useTelemetry(profile: Profile | null, threads: number, running: boolean) {
  const [history, setHistory] = useState<Sample[]>([]);
  const cur = useRef<Sample | null>(null);
  useEffect(() => {
    if (!running || !profile) return;
    const id = setInterval(() => {
      const p = profile;
      const prev = cur.current;
      const k = prev ? 0.35 : 1;
      const lerp = (a: number, b: number) => a + (b - a) * k;
      const dip = p.fps && Math.random() < 0.06 ? (p.low1 ?? p.fps) / p.fps : 1;
      const fpsT = p.fps ? p.fps * dip * (1 + noise(0.035)) : 0;
      const cpuT = Math.min(100, Math.max(0, p.cpuUtil + noise(4)));
      const gpuT = Math.min(100, Math.max(0, p.gpuUtil + noise(2.5)));
      const busy = p.busyThreads;
      const cores = Array.from({ length: threads }, (_, i) => {
        const base = i < busy ? Math.min(100, (p.cpuUtil * threads) / Math.max(1, busy) * (0.75 + 0.25 * Math.random())) : 2 + Math.random() * 7;
        const was = prev?.cores[i] ?? base;
        return Math.min(100, Math.max(0, was + (base - was) * 0.5));
      });
      const next: Sample = {
        fps: prev ? lerp(prev.fps, fpsT) : fpsT,
        cpu: prev ? lerp(prev.cpu, cpuT) : cpuT,
        gpu: prev ? lerp(prev.gpu, gpuT) : gpuT,
        ram: prev ? lerp(prev.ram, p.ramGB + noise(0.15)) : p.ramGB,
        vram: prev ? lerp(prev.vram, p.vramGB + noise(0.05)) : p.vramGB,
        cpuC: prev ? prev.cpuC + (p.cpuC + noise(0.8) - prev.cpuC) * 0.16 : 34,
        gpuC: prev ? prev.gpuC + (p.gpuC + noise(0.4) - prev.gpuC) * 0.09 : 34,
        watts: prev ? lerp(prev.watts, p.wallW + noise(5)) : p.wallW,
        // the card's fans follow its temperature, so they ramp up as it warms
        fan: p.gpuFan ? Math.max(0, (p.gpuFan * Math.max(0, Math.min(1, ((prev?.gpuC ?? 34) - 45) / Math.max(1, p.gpuC - 45)))) + noise(12)) : 0,
        cores,
      };
      cur.current = next;
      setHistory((h) => [...h.slice(-(N - 1)), next]);
    }, 500);
    return () => clearInterval(id);
  }, [profile, threads, running]);
  useEffect(() => {
    if (!running) {
      cur.current = null;
      setHistory([]);
    }
  }, [running]);
  return history;
}

export interface Device {
  threads: number | null;
  memory: number | null;
  gpu: string | null;
  screen: string;
  platform: string;
  heapMB: number | null;
}
/** What the browser can honestly say about this device. */
export function useDevice(enabled: boolean) {
  const [device, setDevice] = useState<Device | null>(null);
  const [fps, setFps] = useState<number[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let gpu: string | null = null;
    try {
      const c = document.createElement("canvas");
      const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      gpu = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl ? String(gl.getParameter(gl.RENDERER)) : null;
      gpu = gpu?.replace(/^ANGLE \(|\)$/g, "").replace(/\s*\(0x[0-9a-f]+\)/i, "").replace(/ Direct3D.*$/, "").replace(/^[^,]+,\s*/, "") ?? null;
    } catch {}
    const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string } };
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    setDevice({
      threads: nav.hardwareConcurrency ?? null,
      memory: nav.deviceMemory ?? null,
      gpu,
      screen: `${screen.width} × ${screen.height} @ ${window.devicePixelRatio}×`,
      platform: nav.userAgentData?.platform || (/Win/.test(nav.userAgent) ? "Windows" : /Mac/.test(nav.userAgent) ? "macOS" : /Android/.test(nav.userAgent) ? "Android" : /iPhone|iPad/.test(nav.userAgent) ? "iOS" : "Unknown"),
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
    });
    // this page's real frame rate, measured every half second
    let frames = 0;
    let raf = 0;
    const count = () => {
      frames++;
      raf = requestAnimationFrame(count);
    };
    raf = requestAnimationFrame(count);
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const f = (frames * 1000) / (now - last);
      frames = 0;
      last = now;
      setFps((h) => [...h.slice(-59), f]);
      const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      if (m) setDevice((d) => (d ? { ...d, heapMB: Math.round(m.usedJSHeapSize / 1048576) } : d));
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [enabled]);
  return { device, fps };
}
