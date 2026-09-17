"use client";

// Note: The assets are stored in the `/public/image/stamp/` directory.

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { PiShuffleBold } from "react-icons/pi";
import { Special_Elite } from "next/font/google";

const specialEliteFont = Special_Elite({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-special_elite",
});

const stamps = [
  {
    id: "delhi",
    image: "/image/stamp/delhi.webp",
    x: 45,
    y: 65,
    rotate: -45,
    title: "Delhi",
    nativeTitle: "दिल्ली",
    place: "Red Fort",
    year: "1648",
  },

  {
    id: "chennai",
    image: "/image/stamp/chennai.webp",
    x: 56,
    y: 30,
    rotate: 6,
    title: "Chennai",
    nativeTitle: "சென்னை",
    place: "Marina LightHouse",
    year: "1977",
  },
  {
    id: "mumbai",
    image: "/image/stamp/mumbai.webp",
    x: 40,
    y: 35,
    rotate: -6,
    title: "Mumbai",
    nativeTitle: "मुंबई",
    place: "Gateway of India",
    year: "1924",
  },
  {
    id: "kerala",
    image: "/image/stamp/kerala.webp",
    x: 50,
    y: 45,
    rotate: 15,
    title: "Kerala",
    nativeTitle: "കേരളം",
    place: "Bekal Fort",
    year: "1650",
  },
];

// Default scale for stamps in their resting state
const RESTING_SCALE = 0.9;
// Scale for the active (zoomed) stamp
const ACTIVE_SCALE = 2;
// Target position: 40% from top of viewport, centered horizontally
const ACTIVE_TOP_VH = 0.4;

const MotionStamps = () => {
  const [activeStampId, setActiveStampId] = useState<string | null>(null);
  const stampRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Pixel offset to move the active stamp from its resting position
  // to the viewport center target
  const [activeOffset, setActiveOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [stampPositions, setStampPositions] = useState<
    Record<string, { x: number; y: number; rotate: number }>
  >(() =>
    Object.fromEntries(
      stamps.map((stamp) => [
        stamp.id,
        { x: stamp.x, y: stamp.y, rotate: stamp.rotate },
      ]),
    ),
  );

  const [zIndexes, setZIndexes] = useState<Record<string, number>>(
    Object.fromEntries(stamps.map((stamp, index) => [stamp.id, 10 + index])),
  );
  const [topZ, setTopZ] = useState(20);

  const activeStamp = stamps.find((s) => s.id === activeStampId);

  const handleShuffle = useCallback(() => {
    // If a stamp is active, dismiss it first
    if (activeStampId) {
      setActiveStampId(null);
      setActiveOffset(null);
    }

    // Distribute stamps randomly in clustered sectors around center (48%, 46%)
    const randomPhase = Math.random() * Math.PI * 2;
    const sectorOrder = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    const zOrder = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
    const newTopZ = topZ + 10;
    setTopZ(newTopZ);

    const newPositions: Record<
      string,
      { x: number; y: number; rotate: number }
    > = {};
    const newZIndexes: Record<string, number> = {};

    stamps.forEach((stamp, index) => {
      const sector = sectorOrder[index];
      // Distribute angles in 4 sectors around center with jitter
      const angle =
        randomPhase +
        (sector * (Math.PI * 2)) / 4 +
        (Math.random() - 0.5) * 0.5;

      // Radii for x and y to keep all stamps clustered close to center like default
      const rx = 5 + Math.random() * 8; // ~5% to 13% spread in x
      const ry = 7 + Math.random() * 11; // ~7% to 18% spread in y

      const x = Math.round(48 + Math.cos(angle) * rx);
      const y = Math.round(46 + Math.sin(angle) * ry);
      // Random rotation between -45deg and +35deg
      const rotate = Math.round(-45 + Math.random() * 80);

      newPositions[stamp.id] = { x, y, rotate };
      newZIndexes[stamp.id] = newTopZ + zOrder[index];
    });

    setStampPositions(newPositions);
    setZIndexes(newZIndexes);
  }, [activeStampId, topZ]);

  const handleStampClick = useCallback(
    (stamp: any) => {
      const newZ = topZ + 1;
      setTopZ(newZ);
      setZIndexes((prev) => ({ ...prev, [stamp.id]: newZ }));

      if (activeStampId === stamp.id) {
        // Deactivate — animate back to resting position
        setActiveOffset(null);
        setActiveStampId(null);
        return;
      }

      // Compute offset from resting position to viewport target
      const el = stampRefs.current[stamp.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        const stampCenterX = rect.left + rect.width / 2;
        const stampCenterY = rect.top + rect.height / 2;

        const targetX = window.innerWidth / 2;
        const targetY = window.innerHeight * ACTIVE_TOP_VH;

        setActiveOffset({
          x: targetX - stampCenterX,
          y: targetY - stampCenterY,
        });
      }

      setActiveStampId(stamp.id);
    },
    [activeStampId, topZ],
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(() => {
    if (activeStamp) {
      handleStampClick(activeStamp);
    }
  }, [activeStamp, handleStampClick]);

  return (
    <div className="relative h-dvh w-full bg-neutral-900">
      {/* BACKGROUND GRID */}
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          opacity-[0.04]
          bg-[linear-gradient(to_right,#ffffff_2px,transparent_1px),linear-gradient(to_bottom,#ffffff_2px,transparent_1px)]
          bg-size-[170px_170px]
        "
      />
      {/* BACKDROP (blur overlay) */}
      <AnimatePresence>
        {activeStamp && (
          <motion.div
            key="backdrop"
            onClick={handleBackdropClick}
            className="fixed inset-0 z-999 bg-black/45 backdrop-blur-[10px] cursor-pointer touch-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>

      <div className=" absolute inset-0 flex flex-col items-center">
        {/* Stamps */}
        <div className="relative h-[70%] w-[90%] md:w-[75%] lg:w-[65%] xl:w-[50%]">
          {stamps.map((stamp) => {
            const isActive = activeStampId === stamp.id;
            const pos = stampPositions[stamp.id] || {
              x: stamp.x,
              y: stamp.y,
              rotate: stamp.rotate,
            };
            return (
              <motion.button
                key={stamp.id}
                ref={(el) => {
                  stampRefs.current[stamp.id] = el;
                }}
                onClick={() => handleStampClick(stamp)}
                type="button"
                className="
                absolute
                block
                cursor-pointer
                appearance-none
                border-0
                bg-transparent
                p-0
                outline-none
                select-none
                [-webkit-user-drag:none]
                -translate-x-1/2
                -translate-y-1/2
              "
                initial={false}
                style={{
                  width: 180,
                  transformOrigin: "center center",
                  zIndex: isActive ? 1000 : zIndexes[stamp.id],
                }}
                animate={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  x: isActive && activeOffset ? activeOffset.x : 0,
                  y: isActive && activeOffset ? activeOffset.y : 0,
                  rotate: isActive ? 0 : pos.rotate,
                  scale: isActive ? ACTIVE_SCALE : RESTING_SCALE,
                }}
                whileHover={
                  !isActive ? { scale: RESTING_SCALE + 0.025 } : undefined
                }
                whileTap={{
                  scale: isActive ? ACTIVE_SCALE - 0.1 : RESTING_SCALE - 0.015,
                }}
                transition={{
                  duration: 0.72,
                  ease: [0.22, 1, 0.36, 1],
                }}
                draggable={false}
              >
                <Image
                  src={"/image/stamp/stamp-base.webp"}
                  alt={stamp.title}
                  width={180}
                  height={221}
                  draggable={false}
                  loading="eager"
                  className="
                  block
                  h-auto
                  w-auto
                  select-none
                  pointer-events-none
                  [-webkit-user-drag:none]
                  drop-shadow-md
                "
                />
                <div className="absolute inset-0 m-3.5 ">
                  <Image
                    src={stamp.image}
                    alt={stamp.place}
                    fill
                    className="object-contain relative z-1"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 z-0">
                    <div className="flex justify-between items-center">
                      <p className="text-[8px] font-bold text-red-500">
                        {stamp.year}
                      </p>
                      <p className="text-[7px] font-bold text-black/80 font-mono px-1 ">
                        {stamp.place}
                      </p>
                    </div>
                    <div
                      className={`${specialEliteFont.className} pt-5 -space-y-1.5 text-black/80`}
                    >
                      <h1 className="text-xl font-medium">{stamp.title}</h1>
                      <h2 className="text-[10px]">{stamp.nativeTitle}</h2>
                    </div>
                  </div>
                </div>
                {/* <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="absolute w-full text-white/70 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      Zoom
                    </motion.div>
                  )}
                </AnimatePresence> */}
              </motion.button>
            );
          })}
        </div>

        <div className="h-[30%] w-full bg-neutral-950 p-5 flex justify-center items-center">
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-4xl font-medium uppercase text-white mb-2">
              Motion Stamps
            </h2>
            <p className="font-mono text-white/50 text-center">
              India's most iconic spots now in digital motion stamp.
              <br className="hidden md:block" /> Stay tuned for more.
            </p>
            <motion.button
              onClick={handleShuffle}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="px-5 py-2.5 mt-3 inset-shadow-sm inset-shadow-white/40 rounded-full bg-neutral-900 text-white cursor-pointer flex items-center gap-2 select-none text-sm font-medium"
            >
              <PiShuffleBold />
              Shuffle
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default MotionStamps;
