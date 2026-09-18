"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

interface MagnifierGlassProps {
  /** The image src to magnify */
  imageSrc: string;
  /** The container element ref that bounds the magnifier area */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether the magnifier is active */
  isOpen: boolean;
  /** Zoom factor (default 2) */
  zoom?: number;
  /** Diameter of the magnifier lens in px (default 180) */
  size?: number;
}

const MagnifierGlass: React.FC<MagnifierGlassProps> = ({
  imageSrc,
  containerRef,
  isOpen,
  zoom = 2,
  size = 180,
}) => {
  // Magnifier center position (viewport coordinates)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Track container rect for background-position calculations
  const containerRectRef = useRef<DOMRect | null>(null);
  // Pointer offset relative to lens center at the start of drag
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  // RAF id for smooth 60fps positioning
  const rafRef = useRef<number | null>(null);

  // Preload image
  useEffect(() => {
    if (!isOpen) return;
    const img = new window.Image();
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  // Update container rect
  const updateContainerRect = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        containerRectRef.current = rect;
        return rect;
      }
    }
    return null;
  }, [containerRef]);

  // Initialize position centered over the active stamp when opened
  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      setIsDragging(false);
      return;
    }

    const initPosition = () => {
      const rect = updateContainerRect();
      if (rect) {
        setPos({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        setVisible(true);
      } else {
        setPos({
          x: window.innerWidth / 2,
          y: window.innerHeight * 0.4,
        });
        setVisible(true);
      }
    };

    initPosition();
    const rafId = requestAnimationFrame(initPosition);

    const onResizeOrScroll = () => {
      updateContainerRect();
    };

    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [isOpen, updateContainerRect]);

  // Grab handle pointer event handlers
  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      updateContainerRect();

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if browser doesn't support capture
      }

      dragOffsetRef.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y,
      };
      setIsDragging(true);
    },
    [pos, updateContainerRect],
  );

  const handleHandlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();

      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;

      const margin = size / 2;
      const clampedX = Math.max(margin, Math.min(window.innerWidth - margin, newX));
      const clampedY = Math.max(margin, Math.min(window.innerHeight - margin, newY));

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPos({ x: clampedX, y: clampedY });
      });
    },
    [isDragging, size],
  );

  const handleHandlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      setIsDragging(false);
    },
    [isDragging],
  );

  // Global window listeners during drag for seamless tracking on both desktop and mobile
  useEffect(() => {
    if (!isDragging) return;

    const onWindowPointerMove = (e: PointerEvent) => {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      const margin = size / 2;
      const clampedX = Math.max(margin, Math.min(window.innerWidth - margin, newX));
      const clampedY = Math.max(margin, Math.min(window.innerHeight - margin, newY));

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPos({ x: clampedX, y: clampedY });
      });
    };

    const onWindowPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDragging, size]);

  // Calculate background-position so the lens shows the magnified region
  const getBackgroundProps = (): React.CSSProperties => {
    const rect = containerRectRef.current;
    if (!rect) return { backgroundColor: "#18181b" };

    // How far (0→1) the lens center is relative to container
    const relX = (pos.x - rect.left) / rect.width;
    const relY = (pos.y - rect.top) / rect.height;

    // Zoomed image size
    const bgW = rect.width * zoom;
    const bgH = rect.height * zoom;

    // Align the point on the image with the center of the lens
    const bgX = -(relX * bgW - size / 2);
    const bgY = -(relY * bgH - size / 2);

    return {
      backgroundImage: `url(${imageSrc})`,
      backgroundSize: `${bgW}px ${bgH}px`,
      backgroundPosition: `${bgX}px ${bgY}px`,
      backgroundRepeat: "no-repeat",
      backgroundColor: "#18181b",
    };
  };

  const half = size / 2;

  return (
    <AnimatePresence>
      {isOpen && visible && (
        <motion.div
          key="magnifier-glass"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
          className="fixed select-none pointer-events-none"
          style={{
            left: pos.x - half,
            top: pos.y - half,
            width: size,
            height: size,
            zIndex: 2000,
            willChange: "left, top",
          }}
        >
          {/* Metallic Bezel Rim */}
          <div
            style={{
              position: "absolute",
              inset: -5,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, #f5e2b8 0%, #b38743 30%, #fae8be 55%, #7a541c 80%, #c9a45e 100%)",
              boxShadow: `
                0 20px 48px rgba(0,0,0,0.65),
                0 6px 16px rgba(0,0,0,0.45),
                inset 0 1px 2px rgba(255,255,255,0.6),
                inset 0 -1px 3px rgba(0,0,0,0.6)
              `,
              pointerEvents: "none",
            }}
          />

          {/* Glass Lens (Shows magnified image) */}
          <div
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              overflow: "hidden",
              position: "relative",
              border: "4px solid rgba(80, 50, 15, 0.35)",
              boxShadow: `
                inset 0 0 0 1px rgba(255,255,255,0.25),
                inset 0 0 24px 8px rgba(0,0,0,0.35)
              `,
              pointerEvents: "none",
              ...getBackgroundProps(),
            }}
          >
            {/* Top specular reflection / curved glass highlight */}
            <div
              style={{
                position: "absolute",
                top: "6%",
                left: "14%",
                width: "48%",
                height: "26%",
                borderRadius: "50%",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)",
                transform: "rotate(-18deg)",
                pointerEvents: "none",
                zIndex: 10,
              }}
            />

            {/* Bottom-right secondary reflection */}
            <div
              style={{
                position: "absolute",
                bottom: "10%",
                right: "14%",
                width: "24%",
                height: "14%",
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)",
                pointerEvents: "none",
                zIndex: 10,
              }}
            />

            {/* Subtle inner lens rim shade */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                boxShadow: "inset 0 0 20px 6px rgba(0,0,0,0.25)",
                pointerEvents: "none",
                zIndex: 11,
              }}
            />
          </div>

          {/* Grab Handle - only element with pointer events enabled */}
          <div
            onPointerDown={handleHandlePointerDown}
            onPointerMove={handleHandlePointerMove}
            onPointerUp={handleHandlePointerUp}
            onPointerCancel={handleHandlePointerUp}
            onLostPointerCapture={handleHandlePointerUp}
            className="absolute pointer-events-auto touch-none select-none"
            style={{
              left: "85.35%",
              top: "85.35%",
              transformOrigin: "top center",
              transform: `translate(-50%, 0) rotate(-45deg) ${isDragging ? "scale(0.97)" : "scale(1)"}`,
              transition: isDragging ? "none" : "transform 0.15s ease",
              cursor: isDragging ? "grabbing" : "grab",
              zIndex: 30,
              padding: "16px", // Generous invisible touch target padding (mobile & desktop)
              marginLeft: "-16px",
              marginTop: "-4px",
            }}
            title="Grab to move lens"
          >
            {/* Brass Ferrule (collar attaching handle to rim) */}
            <div
              style={{
                width: 16,
                height: 12,
                margin: "0 auto",
                borderRadius: "3px 3px 1px 1px",
                background:
                  "linear-gradient(90deg, #7a541c 0%, #fae8be 35%, #d9b56f 60%, #5e3f12 100%)",
                boxShadow:
                  "0 2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            />

            {/* Wooden Handle Shaft */}
            <div
              style={{
                width: 18,
                height: 68,
                margin: "0 auto",
                borderRadius: "4px 4px 8px 8px",
                background:
                  "linear-gradient(90deg, #241106 0%, #592e15 22%, #854924 45%, #592e15 75%, #1c0b03 100%)",
                boxShadow: `
                  4px 6px 14px rgba(0,0,0,0.6),
                  inset -2px 0 4px rgba(0,0,0,0.5),
                  inset 2px 0 4px rgba(255,255,255,0.15)
                `,
                border: "1px solid rgba(255,255,255,0.08)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Brass accent rings on handle */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 0,
                  right: 0,
                  height: 3,
                  background:
                    "linear-gradient(90deg, #7a541c 0%, #fae8be 40%, #7a541c 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 19,
                  left: 0,
                  right: 0,
                  height: 2,
                  background:
                    "linear-gradient(90deg, #7a541c 0%, #fae8be 40%, #7a541c 100%)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
                }}
              />
              {/* Wood grain sheen */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: "35%",
                  width: "25%",
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Brass End Pommel */}
            <div
              style={{
                width: 20,
                height: 9,
                margin: "-2px auto 0",
                borderRadius: "2px 2px 6px 6px",
                background:
                  "linear-gradient(90deg, #7a541c 0%, #fae8be 35%, #d9b56f 60%, #5e3f12 100%)",
                boxShadow:
                  "0 3px 6px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MagnifierGlass;