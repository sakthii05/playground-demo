"use client";
// Note: The assets are stored in the `/public/image/window-shutter/` directory.
import {
  motion,
  useMotionValue,
  useTransform,
  useDragControls,
  PanInfo,
  animate,
} from "motion/react";
import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

// Adjust this value (in pixels) to control how far down the shutter stops at the top
const TOP_OFFSET = 30;

export default function WindowShutter() {
  const shutterRef = useRef<HTMLDivElement>(null);
  const isFirstLayout = useRef(true);

  const [height, setHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(true); // 1. Initial State set to Open
  const [hasInteracted, setHasInteracted] = useState(false);

  const y = useMotionValue(0);
  const dragControls = useDragControls();

  // The maximum upward position (slightly down from top based on TOP_OFFSET)
  const topLimit = -(height - TOP_OFFSET);

  // Calculate dynamic brightness based on shutter position (0 = closed/10%, topLimit = open/100%)
  const brightness = useTransform(y, (currentY) => {
    const totalDist = height > TOP_OFFSET ? height - TOP_OFFSET : 1;
    const progress = Math.min(Math.max(-currentY / totalDist, 0), 1);
    const brightnessVal = 0.1 + progress * 0.9; // 0.1 (10%) to 1.0 (100%)
    return `brightness(${brightnessVal})`;
  });

  // Text color: pure white when brightness is 0.1 (closed) to pure black when brightness is 1 (open)
  const textColor = useTransform(y, (currentY) => {
    const totalDist = height > TOP_OFFSET ? height - TOP_OFFSET : 1;
    const progress = Math.min(Math.max(-currentY / totalDist, 0), 1);
    const val = Math.round((1 - progress) * 255);
    return `rgb(${val}, ${val}, ${val})`;
  });

  /*
   * Measure responsive parent height and set starting position to Open
   */
  useEffect(() => {
    if (!shutterRef.current) return;

    const observer = new ResizeObserver(() => {
      const rect = shutterRef.current?.getBoundingClientRect();
      if (rect) {
        setHeight(rect.height);

        // On first render, immediately place the shutter according to initial state
        if (isFirstLayout.current) {
          const initialTopLimit = -(rect.height - TOP_OFFSET);
          y.set(isOpen ? initialTopLimit : 0);
          isFirstLayout.current = false;
        }
      }
    });

    observer.observe(shutterRef.current);
    return () => observer.disconnect();
  }, [y, isOpen]);

  /*
   * Smooth tween animation - clean hard stop, no bounce.
   */
  const animateTo = useCallback(
    (target: number) => {
      animate(y, target, {
        type: "tween",
        ease: [0.32, 0.72, 0, 1], // Smooth ease-out
        duration: 0.45,
      });
    },
    [y],
  );

  // Helper function to safely play audio files from your /public folder
  const playSound = (soundPath: string) => {
    if (typeof window !== "undefined") {
      const audio = new Audio(soundPath);
      audio.volume = 0.5; // adjust volume (0.0 to 1.0)
      audio.play().catch(() => {}); // Prevents browser autoplay policy errors
    }
  };

  const open = useCallback(() => {
    setIsOpen(true);
    animateTo(topLimit);
    playSound("/image/window-shutter/shutter-sound.m4a");
  }, [topLimit, animateTo]);

  const close = useCallback(() => {
    setIsOpen(false);
    animateTo(0);
    playSound("/image/window-shutter/shutter-sound.m4a");
  }, [animateTo]);

  // Drag/pointer interaction
  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };

  /*
   * Drag end logic using customized active travel distance
   */
  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (!height) return;

    const currentY = y.get();
    const velocity = info.velocity.y;

    // Total physical area the shutter can travel
    const activeTravelDistance = height - TOP_OFFSET;
    const threshold = activeTravelDistance * 0.4; // 40%

    if (!isOpen) {
      // Closed state - dragging up
      const draggedDistance = Math.abs(currentY);

      if (draggedDistance >= threshold || velocity < -700) {
        open();
      } else {
        close();
      }
    } else {
      // Open state - dragging down (relative to topLimit)
      const draggedDownDistance = currentY - topLimit;

      if (draggedDownDistance >= threshold || velocity > 700) {
        close();
      } else {
        open();
      }
    }
  };

  return (
    <div className="relative flex flex-col gap-10 justify-center items-center h-dvh w-full overflow-hidden select-none">
      {/* Background layer with brightness filter */}
      <motion.div
        className="absolute inset-0 bg-white -z-10"
        style={{ filter: brightness }}
      />

      {/* Window object with brightness filter */}
      <motion.div
        className="relative w-75 h-60"
        style={{ filter: brightness }}
      >
        {/* Video */}
        <div className="absolute inset-0 overflow-hidden rounded-[5rem] m-1 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source
              src="/image/window-shutter/train-video-day.webm"
              type="video/webm"
            />
          </video>
        </div>

        {/* Inner frame */}
        <div className="absolute inset-0 overflow-hidden rounded-[3rem] z-1">
          <Image
            src="/image/window-shutter/window-inner-frame.webp"
            alt="window-inner-frame"
            loading="eager"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-fit scale-90"
          />
        </div>

        {/* Shutter */}
        <div className="absolute inset-0 overflow-hidden m-4 rounded-2xl z-2">
          <div ref={shutterRef} className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute inset-0 h-full w-full flex justify-center items-center rounded-4xl select-none"
              style={{ y }}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{
                top: topLimit, // Stops slightly down from top
                bottom: 0,
              }}
              dragElastic={0} // No elastic overshoot beyond limits
              dragMomentum={false} // No momentum bounce
              onDragStart={handleInteraction}
              onDragEnd={handleDragEnd}
            >
              <Image
                src="/image/window-shutter/window-shutter.webp"
                alt="window-shutter"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-fill select-none"
              />
              <div
                onPointerDown={(e) => {
                  handleInteraction();
                  dragControls.start(e);
                }}
                className="absolute bottom-1 rounded-b-[6rem] w-[90%] h-6 cursor-grab active:cursor-grabbing touch-none"
                style={{ touchAction: "none" }}
              />
            </motion.div>
          </div>
        </div>

        {/* Outer frame */}
        <div className="absolute inset-0 overflow-hidden rounded-[3rem] z-3 pointer-events-none">
          <Image
            src="/image/window-shutter/window-outer-frame.webp"
            alt="window-outer-frame"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-fit"
          />
        </div>
      </motion.div>

      {/* Text layer with smooth color transition */}
      <motion.div
        className="text-center p-5 space-y-5"
        style={{ color: textColor }}
      >
        <h3 className="text-3xl font-semibold">New Beginnings</h3>
        <p className="opacity-80">
          A train journey is a collection of moments <br /> passing by the
          window.
        </p>
      </motion.div>
    </div>
  );
}
