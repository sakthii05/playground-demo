"use client";
import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

// Preload all portfolio reveal textures so page transitions and theme changes are instantaneous

useTexture.preload([
  "/image/msd/msd-csk.webp",
  "/image/msd/msd.webp",
]);

// Intercept Three.js internal warnings to resolve THREE.Clock deprecation notice triggered by dependencies
if (
  typeof (THREE as unknown as { setConsoleFunction?: unknown })
    .setConsoleFunction === "function"
) {
  const originalWarn = console.warn.bind(console);
  (
    THREE as unknown as {
      setConsoleFunction: (
        fn: (type: string, msg: string, ...rest: unknown[]) => void,
      ) => void;
    }
  ).setConsoleFunction((type, message, ...params) => {
    if (
      type === "warn" &&
      typeof message === "string" &&
      message.includes("Clock: This module has been deprecated")
    ) {
      return;
    }
    if (type === "warn") originalWarn(message, ...params);
    else if (type === "error") console.error(message, ...params);
    else console.log(message, ...params);
  });
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;

  uniform sampler2D uTexFront;
  uniform sampler2D uTexBack;
  uniform sampler2D uDisp;

  uniform float uTime;
  uniform vec2 uPlaneRes;
  uniform vec2 uFrontRes;
  uniform vec2 uBackRes;

  // Calculates UV mapping for object-cover behavior (preserves aspect ratio without distortion)
  vec2 getCoverUv(vec2 uv, vec2 planeRes, vec2 mediaRes) {
    float rs = planeRes.x / planeRes.y;
    float ri = mediaRes.x / mediaRes.y;
    vec2 st = uv;
    if (rs > ri) {
      // Screen is wider than image: crop top and bottom
      float scale = ri / rs;
      st.y = (st.y - 0.5) * scale + 0.5;
    } else {
      // Screen is taller than image: crop left and right
      float scale = rs / ri;
      st.x = (st.x - 0.5) * scale + 0.5;
    }
    return st;
  }

  // Simple procedural noise
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(
      mix(a, b, f.x),
      mix(c, d, f.x),
      f.y
    );
  }

  // Fractal noise
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += noise(p) * amplitude;
      p *= 2.0;
      amplitude *= 0.5;
    }

    return value;
  }

void main() {
    // 1. Calculate the smoke noise FIRST
    vec2 smokeUv = vUv * 7.0;
    float n1 = fbm(smokeUv + vec2(uTime * 0.12, -uTime * 0.08));
    float n2 = fbm(smokeUv * 1.8 + vec2(-uTime * 0.08, uTime * 0.10));
    float smokeNoise = mix(n1, n2, 0.45);

    // 2. Warp the UVs using the noise to destroy the perfect circle shape
    vec2 distortedUv = vUv + (vec2(smokeNoise) - 0.5) * 0.15;

    // 3. Sample the canvas trail using the newly distorted UVs
    float trail = texture2D(uDisp, distortedUv).r;

    // 4. Apply the mask and wisps
    float smokeMask = trail;
    smokeMask *= smoothstep(0.10, 0.75, smokeNoise);

    float wisps = fbm(vUv * 14.0 + vec2(uTime * 0.18, -uTime * 0.12));
    smokeMask += trail * smoothstep(0.45, 0.85, wisps) * 0.35;

    smokeMask = clamp(smokeMask, 0.0, 1.0);
    smokeMask = smoothstep(0.05, 0.55, smokeMask);

    // Sample textures with object-cover UV transformation
    vec2 frontUv = getCoverUv(vUv, uPlaneRes, uFrontRes);
    vec2 backUv = getCoverUv(vUv, uPlaneRes, uBackRes);

    vec4 front = texture2D(uTexFront, frontUv);
    vec4 back = texture2D(uTexBack, backUv);

    gl_FragColor = mix(front, back, smokeMask);
  }
`;

interface FluidRevealProps {
  frontImage: string;
  backImage: string;
}

const SmokeRevealEffect = ({ frontImage, backImage }: FluidRevealProps) => {
  const mesh = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { gl, viewport } = useThree();
  const [front, back] = useTexture([frontImage, backImage]);

  // Use modern THREE.Timer instead of deprecated THREE.Clock
  const timer = useMemo(() => new THREE.Timer(), []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      timer.connect(document);
    }
    return () => {
      timer.dispose();
    };
  }, [timer]);

  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    return c;
  }, []);

  const ctx = useMemo(() => canvas.getContext("2d"), [canvas]);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvas]);

  const lastPositions = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const isPointerDown = useRef(false);
  const pendingStrokes = useRef<
    { x1: number; y1: number; x2: number; y2: number; radius?: number }[]
  >([]);

  useEffect(() => {
    if (ctx) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;
    }
  }, [canvas, ctx, texture]);

  // Clean up canvas texture on unmount
  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  // Ensure Three.js textures are re-uploaded to the WebGL context upon mount / route return
  useEffect(() => {
    if (front) front.needsUpdate = true;
    if (back) back.needsUpdate = true;
    if (texture) texture.needsUpdate = true;
  }, [front, back, texture, gl]);

  // Helper to convert screen client coordinates to canvas pixel space (0 to 256)
  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!gl.domElement) return null;
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
    return {
      x: nx * canvas.width,
      y: ny * canvas.height,
    };
  };

  // Immediate dab for instant feedback on tap/touch down
  const addDab = (x: number, y: number, radius = 16) => {
    if (!ctx) return;
    ctx.globalCompositeOperation = "lighten";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "white";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "white";
    ctx.fill();
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  };

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (!coords) return;
      isPointerDown.current = true;
      lastPositions.current.set(e.pointerId, coords);
      addDab(coords.x, coords.y, e.pointerType === "touch" ? 18 : 14);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      if (!coords) {
        lastPositions.current.delete(e.pointerId);
        return;
      }

      const isTouch = e.pointerType === "touch" || e.pointerType === "pen";
      // Touch requires active contact; mouse works on hover or drag
      if (isTouch && !isPointerDown.current) return;

      const prev = lastPositions.current.get(e.pointerId);
      if (prev) {
        const dist = Math.hypot(coords.x - prev.x, coords.y - prev.y);
        if (dist > 0.4) {
          pendingStrokes.current.push({
            x1: prev.x,
            y1: prev.y,
            x2: coords.x,
            y2: coords.y,
            radius: isTouch ? 28 : 25,
          });
          lastPositions.current.set(e.pointerId, coords);
        }
      } else {
        lastPositions.current.set(e.pointerId, coords);
        if (isTouch) {
          addDab(coords.x, coords.y, 18);
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      lastPositions.current.delete(e.pointerId);
      if (lastPositions.current.size === 0) {
        isPointerDown.current = false;
      }
    };

    // Touch event fallback / enhancements for mobile webviews
    const handleTouchStart = (e: TouchEvent) => {
      isPointerDown.current = true;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const coords = getCanvasCoords(touch.clientX, touch.clientY);
        if (coords) {
          lastPositions.current.set(touch.identifier, coords);
          addDab(coords.x, coords.y, 18);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const coords = getCanvasCoords(touch.clientX, touch.clientY);
        if (!coords) {
          lastPositions.current.delete(touch.identifier);
          continue;
        }
        const prev = lastPositions.current.get(touch.identifier);
        if (prev) {
          const dist = Math.hypot(coords.x - prev.x, coords.y - prev.y);
          if (dist > 0.4) {
            pendingStrokes.current.push({
              x1: prev.x,
              y1: prev.y,
              x2: coords.x,
              y2: coords.y,
              radius: 28,
            });
            lastPositions.current.set(touch.identifier, coords);
          }
        } else {
          lastPositions.current.set(touch.identifier, coords);
          addDab(coords.x, coords.y, 18);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const activeIds = new Set<number>();
      for (let i = 0; i < e.touches.length; i++) {
        activeIds.add(e.touches[i].identifier);
      }
      for (const id of lastPositions.current.keys()) {
        if (!activeIds.has(id)) {
          lastPositions.current.delete(id);
        }
      }
      if (activeIds.size === 0) {
        isPointerDown.current = false;
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointercancel", handlePointerUp, {
      passive: true,
    });

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [gl, canvas]);

  const uniforms = useMemo(
    () => ({
      uTexFront: { value: front },
      uTexBack: { value: back },
      uDisp: { value: texture },
      uTime: { value: 0 },
      uPlaneRes: { value: new THREE.Vector2(viewport.width, viewport.height) },
      uFrontRes: {
        value: new THREE.Vector2(
          (front?.image as HTMLImageElement)?.naturalWidth ||
            (front?.image as HTMLImageElement)?.width ||
            1,
          (front?.image as HTMLImageElement)?.naturalHeight ||
            (front?.image as HTMLImageElement)?.height ||
            1,
        ),
      },
      uBackRes: {
        value: new THREE.Vector2(
          (back?.image as HTMLImageElement)?.naturalWidth ||
            (back?.image as HTMLImageElement)?.width ||
            1,
          (back?.image as HTMLImageElement)?.naturalHeight ||
            (back?.image as HTMLImageElement)?.height ||
            1,
        ),
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [front, back, texture],
  );

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTexFront.value = front;
      materialRef.current.uniforms.uTexBack.value = back;
      materialRef.current.uniforms.uDisp.value = texture;
      const fImg = front?.image as HTMLImageElement | undefined;
      const bImg = back?.image as HTMLImageElement | undefined;
      materialRef.current.uniforms.uFrontRes.value.set(
        fImg?.naturalWidth || fImg?.width || 1,
        fImg?.naturalHeight || fImg?.height || 1,
      );
      materialRef.current.uniforms.uBackRes.value.set(
        bImg?.naturalWidth || bImg?.width || 1,
        bImg?.naturalHeight || bImg?.height || 1,
      );
      materialRef.current.needsUpdate = true;
    }
  }, [front, back, texture]);

  useFrame(() => {
    // 1. Update Timer and shader uniforms
    timer.update();
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = timer.getElapsed();
      materialRef.current.uniforms.uPlaneRes.value.set(
        viewport.width,
        viewport.height,
      );
    }

    if (!ctx) return;

    // 2. Fade the canvas to black continuously (settles fluid trail)
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 0, 0, 0.055)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Draw queued fluid strokes from mouse and touch interactions
    const strokes = pendingStrokes.current;
    if (strokes.length > 0) {
      ctx.globalCompositeOperation = "lighten";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 0; i < strokes.length; i++) {
        const stroke = strokes[i];
        ctx.lineWidth = stroke.radius || 26;
        ctx.shadowBlur = 18;
        ctx.shadowColor = "white";
        ctx.strokeStyle = "white";

        ctx.beginPath();
        ctx.moveTo(stroke.x1, stroke.y1);
        ctx.lineTo(stroke.x2, stroke.y2);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      pendingStrokes.current = [];
      texture.needsUpdate = true;
    }
  });

  return (
    <mesh ref={mesh} dispose={null}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
};

export default SmokeRevealEffect;
