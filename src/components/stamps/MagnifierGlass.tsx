'use client'
import { AnimatePresence, motion } from 'motion/react';
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image';

const MagnifierGlass = () => {
    // --- Magnifier state ---
      const [magnifierOpen, setMagnifierOpen] = useState(false);
      const [magnifierPos, setMagnifierPos] = useState({ x: 0, y: 0 });
      const [isDraggingMagnifier, setIsDraggingMagnifier] = useState(false);
      const dragOffset = useRef({ x: 0, y: 0 });
      const stampRefs = useRef<Record<string, HTMLDivElement | null>>({});
      const magnifierRef = useRef<HTMLDivElement | null>(null);
      const activeStampId ="chennai"
      const MAGNIFIER_SIZE = 1
      const MAGNIFIER_ZOOM = 1;
      const activeStamp = {
        id: "chennai",
        image: "/image/stamp/chennai.webp",
        x: 56,
        y: 30,
        rotate: 6,
        title: "Chennai",
        nativeTitle: "சென்னை",
        place: "Marina LightHouse",
        year: "1977",
      };
    
      // Reset magnifier when active stamp changes or closes
      useEffect(() => {
        setMagnifierOpen(false);
      }, [activeStampId]);
    
      // Center the magnifier on the active stamp when opened
      const handleToggleMagnifier = useCallback(() => {
        if (magnifierOpen) {
          setMagnifierOpen(false);
          return;
        }
        if (!activeStampId) return;
        const el = stampRefs.current[activeStampId];
        if (el) {
          const rect = el.getBoundingClientRect();
          setMagnifierPos({
            x: rect.left + rect.width / 2 - MAGNIFIER_SIZE / 2,
            y: rect.top + rect.height / 2 - MAGNIFIER_SIZE / 2,
          });
        }
        setMagnifierOpen(true);
      }, [magnifierOpen, activeStampId]);
    
      // Pointer event handlers for dragging the magnifier
      const handleMagnifierPointerDown = useCallback(
        (e: React.PointerEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingMagnifier(true);
          dragOffset.current = {
            x: e.clientX - magnifierPos.x,
            y: e.clientY - magnifierPos.y,
          };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        },
        [magnifierPos],
      );
    
      const handleMagnifierPointerMove = useCallback(
        (e: React.PointerEvent) => {
          if (!isDraggingMagnifier) return;
          setMagnifierPos({
            x: e.clientX - dragOffset.current.x,
            y: e.clientY - dragOffset.current.y,
          });
        },
        [isDraggingMagnifier],
      );
    
      const handleMagnifierPointerUp = useCallback(() => {
        setIsDraggingMagnifier(false);
      }, []);
    
  return (
    <AnimatePresence>
      {magnifierOpen &&
        activeStamp &&
        (() => {
          // Compute the stamp's current on-screen rect
          const el = stampRefs.current[activeStamp.id];
          const stampRect = el?.getBoundingClientRect();
          if (!stampRect) return null;

          // Center of magnifier in viewport
          const magCenterX = magnifierPos.x + MAGNIFIER_SIZE / 2;
          const magCenterY = magnifierPos.y + MAGNIFIER_SIZE / 2;

          // The scaled-up stamp dimensions
          const scaledW = stampRect.width * MAGNIFIER_ZOOM;
          const scaledH = stampRect.height * MAGNIFIER_ZOOM;

          // Position the scaled clone so the point under magnifier center is centered in the circle
          const cloneLeft =
            MAGNIFIER_SIZE / 2 - (magCenterX - stampRect.left) * MAGNIFIER_ZOOM;
          const cloneTop =
            MAGNIFIER_SIZE / 2 - (magCenterY - stampRect.top) * MAGNIFIER_ZOOM;

          return (
            <motion.div
              key="magnifier"
              ref={magnifierRef}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              onPointerDown={handleMagnifierPointerDown}
              onPointerMove={handleMagnifierPointerMove}
              onPointerUp={handleMagnifierPointerUp}
              className="fixed select-none touch-none"
              style={{
                left: magnifierPos.x,
                top: magnifierPos.y,
                width: MAGNIFIER_SIZE,
                height: MAGNIFIER_SIZE,
                zIndex: 2000,
                cursor: isDraggingMagnifier ? "grabbing" : "grab",
              }}
            >
              {/* Glass lens — shows zoomed stamp clone */}
              <div
                style={{
                  width: MAGNIFIER_SIZE,
                  height: MAGNIFIER_SIZE,
                  borderRadius: "50%",
                  overflow: "hidden",
                  position: "relative",
                  border: "6px solid rgba(200,200,210,0.55)",
                  boxShadow: `
                    0 0 0 2px rgba(120,120,130,0.3),
                    0 8px 32px rgba(0,0,0,0.55),
                    inset 0 2px 8px rgba(255,255,255,0.18),
                    inset 0 -4px 12px rgba(0,0,0,0.2)
                  `,
                  background: "#1a1a1a",
                }}
              >
                {/* Scaled clone of the full stamp */}
                <div
                  style={{
                    position: "absolute",
                    left: cloneLeft,
                    top: cloneTop,
                    width: scaledW,
                    height: scaledH,
                    pointerEvents: "none",
                  }}
                >
                  {/* Stamp base */}
                  <Image
                    src="/image/stamp/stamp-base.webp"
                    alt=""
                    width={180}
                    height={221}
                    draggable={false}
                    className="block w-full h-full select-none pointer-events-none"
                  />
                  {/* Inner content (photo + text) */}
                  <div className="absolute inset-0 m-[7%]">
                    <Image
                      src={activeStamp.image}
                      alt={activeStamp.place}
                      fill
                      className="object-contain relative z-10"
                      sizes="400px"
                    />
                    <div className="absolute inset-0 z-0">
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] font-bold text-red-500">
                          {activeStamp.year}
                        </p>
                        <p className="text-[7px] font-bold text-black/80 font-mono px-1">
                          {activeStamp.place}
                        </p>
                      </div>
                      <div
                        className={`pt-5 -space-y-1.5 text-black/80`}
                      >
                        <h1 className="text-xl font-medium">
                          {activeStamp.title}
                        </h1>
                        <h2 className="text-[10px]">
                          {activeStamp.nativeTitle}
                        </h2>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specular reflection / glare */}
                <div
                  style={{
                    position: "absolute",
                    top: "8%",
                    left: "15%",
                    width: "45%",
                    height: "30%",
                    borderRadius: "50%",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)",
                    transform: "rotate(-20deg)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />
                {/* Secondary subtle reflection */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "12%",
                    right: "18%",
                    width: "20%",
                    height: "12%",
                    borderRadius: "50%",
                    background:
                      "radial-gradient(ellipse, rgba(255,255,255,0.1) 0%, transparent 70%)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />
              </div>
              {/* Handle */}
              <div
                style={{
                  position: "absolute",
                  bottom: -22,
                  left: "50%",
                  transform: "translateX(-50%) rotate(45deg)",
                  width: 14,
                  height: 32,
                  borderRadius: 6,
                  background:
                    "linear-gradient(135deg, #8B7355 0%, #6B5640 50%, #4A3C2A 100%)",
                  boxShadow: "2px 4px 8px rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </motion.div>
          );
        })()}
    </AnimatePresence>
  );
}

export default MagnifierGlass