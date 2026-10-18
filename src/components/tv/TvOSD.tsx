"use client";

import React, { useEffect, useState } from "react";
import { TVOSDState } from "./types";

interface TvOSDProps {
  osdState: TVOSDState;
  isRecording?: boolean;
}

export const TvOSD: React.FC<TvOSDProps> = ({ osdState, isRecording }) => {
  const [flickerKey, setFlickerKey] = useState(0);

  useEffect(() => {
    if (osdState.visible) {
      setFlickerKey((prev) => prev + 1);
    }
  }, [osdState]);

  // Render volume bar
  const renderVolume = (val = 0) => {
    const totalBars = 16;
    const filledBars = Math.round((val / 100) * totalBars);
    const bars = "█".repeat(filledBars) + "░".repeat(Math.max(0, totalBars - filledBars));
    return (
      <div className="flex flex-col gap-1 items-start">
        <div className="text-[13px] tracking-widest text-[#38ef7d]">
          {val === 0 ? "VOLUME: MUTE" : `VOLUME: ${val}%`}
        </div>
        <div className="text-[15px] font-mono tracking-tighter text-[#38ef7d] select-none">
          {bars}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 px-8 py-6 sm:px-10 sm:py-8 flex flex-col justify-between">
      {/* Top Bar OSD (Channel / Status / Recording) */}
      <div className="flex justify-between items-start w-full">
        {/* Main Status OSD */}
        <div
          key={`osd-${flickerKey}`}
          className={`transition-opacity duration-300 ${
            osdState.visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {osdState.type === "channel" && (
            <div className="retro-osd-text text-xl sm:text-2xl font-bold tracking-wider drop-shadow">
              {osdState.title || "CH 01"}
              {osdState.subtitle && (
                <div className="text-xs text-[#2fd16d] tracking-widest font-normal opacity-90 mt-0.5">
                  {osdState.subtitle}
                </div>
              )}
            </div>
          )}

          {osdState.type === "volume" && (
            <div className="bg-black/60 px-3 py-1.5 rounded border border-[#38ef7d]/30 backdrop-blur-[2px]">
              {renderVolume(osdState.value)}
            </div>
          )}

          {osdState.type === "play" && (
            <div className="retro-osd-text text-lg sm:text-xl font-bold flex items-center gap-2">
              <span>PLAY</span>
              <span className="text-base animate-pulse">▶</span>
            </div>
          )}

          {osdState.type === "pause" && (
            <div className="retro-osd-text text-lg sm:text-xl font-bold flex items-center gap-2">
              <span>PAUSE</span>
              <span className="text-base">❚❚</span>
            </div>
          )}

          {osdState.type === "stop" && (
            <div className="retro-osd-text text-lg sm:text-xl font-bold flex items-center gap-2 text-yellow-300/95" style={{ textShadow: "0 0 6px rgba(253, 224, 71, 0.6)" }}>
              <span>STOP</span>
              <span className="text-sm">■</span>
            </div>
          )}

          {osdState.type === "rewind" && (
            <div className="retro-osd-text text-lg sm:text-xl font-bold flex items-center gap-1.5">
              <span className="animate-pulse">◀◀</span>
              <span>REW -10s</span>
            </div>
          )}

          {osdState.type === "fast-forward" && (
            <div className="retro-osd-text text-lg sm:text-xl font-bold flex items-center gap-1.5">
              <span>FF +10s</span>
              <span className="animate-pulse">▶▶</span>
            </div>
          )}
        </div>

        {/* Permanent or toggled REC indicator */}
        {isRecording && (
          <div className="retro-osd-rec text-sm sm:text-base font-bold flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded border border-red-500/30">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span>● REC</span>
          </div>
        )}
      </div>

      {/* Bottom corner timecode / channel tag for authentic vintage CRT feel */}
      <div className="flex justify-between items-end pb-2 sm:pb-3 text-[10px] sm:text-xs text-[#38ef7d]/80 font-mono tracking-wider">
        <span className="opacity-90">SP AUTO TRACKING</span>
        <span className="opacity-80">NTSC-M 525</span>
      </div>
    </div>
  );
};
