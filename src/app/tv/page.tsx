"use client";

import React from "react";
import { InteractiveTV, TVChannel } from "@/components/tv";

const CHANNELS: TVChannel[] = [
  {
    id: 1,
    name: "CH 01 - RETRO VISION",
    src: "/videos/channel-01.mp4",
    genre: "NTSC Broadcast",
  },
  {
    id: 2,
    name: "CH 02 - CYBERWAVE",
    src: "/videos/channel-02.mp4",
    genre: "Synthwave Night",
  },
  {
    id: 3,
    name: "CH 03 - MIDNIGHT CINEMA",
    src: "/videos/channel-03.mp4",
    genre: "Classic Archive",
  },
  {
    id: 4,
    name: "CH 04 - SPACE TELEMETRY",
    src: "/videos/channel-04.mp4",
    genre: "Deep Orbit Feed",
  },
];

const TvPlayer = () => {
  return (
    <main className="relative min-h-dvh w-full bg-[#0a0c10] text-neutral-200 flex flex-col justify-center items-center p-3 sm:p-6 md:p-8 overflow-x-hidden selection:bg-[#38ef7d]/30">
      {/* Ambient background glow mimicking CRT screen back-illumination */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] max-w-[800px] h-[55vh] rounded-full bg-cyan-950/20 blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] max-w-[500px] h-[40vh] rounded-full bg-emerald-950/15 blur-[100px] pointer-events-none" />

      {/* Main TV Container */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center max-w-[1000px]">
        <InteractiveTV channels={CHANNELS} defaultChannel={1} defaultVolume={0.7} />
      </div>

    
      
    </main>
  );
};

export default TvPlayer;