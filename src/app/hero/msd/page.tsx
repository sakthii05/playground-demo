"use client";
import SmokeRevealEffect from "@/components/herosection/msd/SmokeRevealEffect";
import { Canvas } from "@react-three/fiber";
import React, { Suspense } from "react";

const MsdHeroSection = () => {
  return (
    <div className="relative w-full h-dvh overflow-hidden bg-white cursor-none select-none">
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{
            position: [0, 0, 1],
          }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <SmokeRevealEffect
              frontImage={"/image/msd/msd.webp"}
              backImage={"/image/msd/msd-csk.webp"}
            />
          </Suspense>
        </Canvas>
      </div>

      {/* ── text overlay layer (mix-blend-mode for inversion) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 3 }}
      >
        {/* Name — top left */}
        <div className="absolute top-8 left-8 md:top-12 md:left-12">
          <h1
            className={` leading-[0.9] tracking-tight`}
            style={{
              mixBlendMode: "difference",
              color: "#000",
              transition: "color 300ms ease",
            }}
          >
            <span className="block text-3xl md:text-5xl lg:text-6xl font-bold">
              MAHENDRA
            </span>
            <span className="block text-3xl md:text-5xl lg:text-6xl font-bold">
              SINGH
            </span>
            <span className="block text-5xl md:text-7xl lg:text-8xl font-black mt-1">
              DHONI
            </span>
          </h1>
        </div>

        {/* ABOUT — top right */}
        <div className="absolute top-8 right-8 md:top-12 md:right-12 pointer-events-auto">
          <a
            href="#about"
            className="text-sm md:text-base tracking-[0.3em] font-medium hover:opacity-70 transition-opacity duration-300"
            style={{
              mixBlendMode: "difference",
              color: "#000",
              transition: "color 300ms ease, opacity 300ms ease",
            }}
          >
            ABOUT
          </a>
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-8 left-8 md:bottom-12 md:left-12">
          <p
            className="text-xs md:text-sm tracking-[0.2em] uppercase font-light"
            style={{
              mixBlendMode: "difference",
              color: "#000",
              transition: "color 300ms ease",
            }}
          >
            Captain · Leader · Legend
          </p>
        </div>

        {/* Bottom right — jersey number */}
        <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
          <span
            className={` text-6xl md:text-8xl font-black`}
            style={{
              mixBlendMode: "difference",
              color: "#000",
              transition: "color 300ms ease",
              opacity: 0.15,
            }}
          >
            07
          </span>
        </div>
      </div>
    </div>
  );
};

export default MsdHeroSection;
