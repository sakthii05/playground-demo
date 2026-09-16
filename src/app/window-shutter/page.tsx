"use client";

import {
  motion,
  useMotionValue,
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [height, setHeight] = useState(0);
  const [isOpen, setIsOpen] = useState(false); // 1. Initial State set to Open
  const [hasInteracted, setHasInteracted] = useState(false);

  const y = useMotionValue(0);
  const dragControls = useDragControls();

  // The maximum upward position (slightly down from top based on TOP_OFFSET)
  const topLimit = -(height - TOP_OFFSET);

  /*
   * Measure responsive parent height and set starting position to Open
   */
  useEffect(() => {
    if (!shutterRef.current) return;

    const observer = new ResizeObserver(() => {
      const rect = shutterRef.current?.getBoundingClientRect();
      if (rect) {
        setHeight(rect.height);

        // On first render, immediately place the shutter in the open position
        // if (isFirstLayout.current) {
        //   const initialTopLimit = -(rect.height - TOP_OFFSET);
        //   y.set(initialTopLimit);
        //   isFirstLayout.current = false;
        // }
      }
    });

    observer.observe(shutterRef.current);
    return () => observer.disconnect();
  }, [y]);

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

  // const autoAnimateTo = useCallback(
  //   (target: number) => {
  //     animate(y, target, {
  //       type: "tween",
  //       ease: [0.32, 0.72, 0, 1], // Smooth ease-out
  //       duration: 2,
  //     });
  //   },
  //   [y],
  // );
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
    playSound("/images/experience/shutter-sound.m4a");
  }, [topLimit, animateTo]);

  const close = useCallback(() => {
    setIsOpen(false);
    animateTo(0);
    playSound("/images/experience/shutter-sound.m4a");
  }, [animateTo]);

  // const autoClose = useCallback(() => {
  //   setIsOpen(false);
  //   autoAnimateTo(0);
  // }, [autoAnimateTo]);

  /*
   * 2. Auto-close after 6 seconds of no interaction
   */
  // useEffect(() => {
  //   if (height > 0 && !hasInteracted) {
  //     timerRef.current = setTimeout(() => {
  //       autoClose();
  //     }, 6000); // 6 seconds
  //   }

  //   return () => {
  //     if (timerRef.current) clearTimeout(timerRef.current);
  //   };
  // }, [height, hasInteracted, close]);

  // Cancel the timer immediately on first drag/pointer interaction
  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
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
    <div className="flex justify-center items-center h-dvh w-full">
      <div className=" relative w-60 h-45 md:w-[300px] md:h-60">
        {/* video */}
        <div className="absolute inset-0 overflow-hidden rounded-[5rem] m-1 z-0 ">
          {/* <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={""} type="video/mp4" />
          </video> */}
        </div>
        {/* inner-frame */}
        <div className="absolute inset-0 overflow-hidden rounded-[3rem] z-1 ">
          <Image
            src={"/image/window-shutter/window-inner-frame.webp"}
            alt="window-inner-farme"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-fit scale-90  brightness-100
              dark:brightness-30"
          />
        </div>
        {/* shutter */}
        <div className="absolute inset-0 overflow-hidden m-2.5 md:m-4 rounded-2xl z-2">
          <div ref={shutterRef} className="absolute inset-0 overflow-hidden">
            <motion.div
              className="
          absolute inset-0
          h-full w-full
          flex justify-center items-center
          rounded-4xl
          select-none 
        "
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
                className="
              pointer-events-none
              absolute
              inset-0
              h-full
              w-full
              object-fill
               select-none
              brightness-100
              dark:brightness-30
            "
              />
              <div
                onPointerDown={(e) => {
                  handleInteraction();
                  dragControls.start(e);
                }}
                className="
            absolute bottom-1 rounded-b-[6rem]
            w-[90%] h-6 
            cursor-grab active:cursor-grabbing
            touch-none
          "
                style={{ touchAction: "none" }}
              ></div>
            </motion.div>
          </div>
        </div>
        {/* outer-farme */}
        <div className="absolute inset-0 overflow-hidden rounded-[3rem] z-3 pointer-events-none ">
          <Image
            src={"/image/window-shutter/window-outer-frame.webp"}
            alt="window-outer-farme"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-fit  brightness-100
              dark:brightness-30"
          />
        </div>
      </div>
    </div>
  );
}
