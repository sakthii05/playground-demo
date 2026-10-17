"use client";

import React, { useEffect, useRef, useState } from "react";
import { TVChannel, TVOSDState } from "./types";
import { TvOSD } from "./TvOSD";

interface TvScreenProps {
  currentChannel: TVChannel;
  isPoweredOn: boolean;
  isPlaying: boolean;
  volume: number;
  isRecording: boolean;
  osdState: TVOSDState;
  channelSwitchKey: number;
  onVideoEnd?: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const TvScreen: React.FC<TvScreenProps> = ({
  currentChannel,
  isPoweredOn,
  isPlaying,
  volume,
  isRecording,
  osdState,
  channelSwitchKey,
  onVideoEnd,
  videoRef,
}) => {
  const [hasVideoLoaded, setHasVideoLoaded] = useState(false);
  const [timeString, setTimeString] = useState("12:00:00");
  const [powerAnimationClass, setPowerAnimationClass] = useState("");
  const isInitialMount = useRef(true);

  // Power state animation handling
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (isPoweredOn) {
        setPowerAnimationClass("crt-power-on");
      }
      return;
    }

    if (isPoweredOn) {
      setPowerAnimationClass("crt-power-on");
    } else {
      setPowerAnimationClass("crt-power-off");
    }
  }, [isPoweredOn]);

  // Sync video volume & playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = volume === 0;
  }, [volume, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPoweredOn && isPlaying) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay or source error handled smoothly
        });
      }
    } else {
      video.pause();
    }
  }, [isPoweredOn, isPlaying, currentChannel, videoRef]);

  // Retro Clock simulator for authentic broadcast timecode
  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setTimeString(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Check if current channel has a valid video source
  const hasSource = Boolean(currentChannel.src && currentChannel.src.trim() !== "");

  // Channel fallback retro graphics (when no video is provided or loading)
  const renderFallbackBroadcast = () => {
    const id = currentChannel.id;

    if (id === 1) {
      // Channel 1: SMPTE Retro Color Bars + Broadcast Card
      return (
        <div className="absolute inset-0 flex flex-col select-none bg-black">
          {/* Top 65% SMPTE color bars */}
          <div className="h-[65%] w-full flex">
            <div className="flex-1 bg-[#c0c0c0]" />
            <div className="flex-1 bg-[#c0c000]" />
            <div className="flex-1 bg-[#00c0c0]" />
            <div className="flex-1 bg-[#00c000]" />
            <div className="flex-1 bg-[#c000c0]" />
            <div className="flex-1 bg-[#c00000]" />
            <div className="flex-1 bg-[#0000c0]" />
          </div>
          {/* Middle 15% sub bars */}
          <div className="h-[15%] w-full flex">
            <div className="flex-1 bg-[#0000c0]" />
            <div className="flex-1 bg-[#131313]" />
            <div className="flex-1 bg-[#c000c0]" />
            <div className="flex-1 bg-[#131313]" />
            <div className="flex-1 bg-[#00c0c0]" />
            <div className="flex-1 bg-[#131313]" />
            <div className="flex-1 bg-[#c0c0c0]" />
          </div>
          {/* Bottom 20% PLUGE and black levels */}
          <div className="h-[20%] w-full flex items-center justify-between px-6 bg-[#080808]">
            <div className="flex items-center gap-2">
              <span className="text-white/90 font-mono text-xs font-bold tracking-widest">RETRO-VISION 1</span>
              <span className="text-[#38ef7d] font-mono text-[10px]">● BROADCAST</span>
            </div>
            <div className="font-mono text-white/80 text-xs tracking-wider">
              {timeString}
            </div>
          </div>
          {/* Center station badge */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/85 border border-white/20 px-6 py-2.5 rounded shadow-2xl text-center backdrop-blur-xs">
              <div className="text-white font-black tracking-widest text-lg sm:text-xl font-mono">
                CHANNEL 01
              </div>
              <div className="text-[#38ef7d] text-[11px] font-mono tracking-widest mt-0.5">
                VINTAGE TELEVISION FEED
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (id === 2) {
      // Channel 2: Synthwave 90s Neon Wireframe
      return (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0826] via-[#1c0f38] to-[#2c003e] flex flex-col items-center justify-center overflow-hidden select-none">
          {/* Neon wireframe horizon */}
          <div className="absolute w-[180px] h-[180px] rounded-full bg-gradient-to-t from-[#ff007f] to-[#ffb703] blur-[1px] opacity-90 bottom-[28%]" />
          <div
            className="absolute bottom-0 w-full h-[36%] border-t-2 border-[#ff007f]/60"
            style={{
              background: `repeating-linear-gradient(to bottom, transparent 0px, transparent 14px, rgba(0,255,255,0.4) 15px),
                           repeating-linear-gradient(to right, transparent 0px, transparent 28px, rgba(0,255,255,0.3) 29px)`,
              transform: "perspective(120px) rotateX(45deg)",
              transformOrigin: "bottom center",
            }}
          />
          <div className="relative z-10 text-center px-4">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#00f2fe] to-[#4facfe] font-mono drop-shadow-[0_0_12px_rgba(0,242,254,0.8)]">
              CH 02
            </div>
            <div className="text-pink-300 font-mono text-xs sm:text-sm tracking-widest mt-1">
              CYBER-WAVE NETWORK
            </div>
            <div className="mt-2 text-[#38ef7d] font-mono text-[11px] tracking-wider">
              REC STATUS: {isRecording ? "ACTIVE" : "STANDBY"}
            </div>
          </div>
        </div>
      );
    }

    if (id === 3) {
      // Channel 3: Nostalgia Classic Movies / Midnight Cinema
      return (
        <div className="absolute inset-0 bg-[#070b12] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
          {/* Subtle spinning vinyl or film reel accent */}
          <div className="absolute w-[240px] h-[240px] rounded-full border border-dashed border-amber-500/20 animate-spin" style={{ animationDuration: "20s" }} />
          <div className="relative z-10">
            <div className="text-amber-400 font-serif tracking-widest text-2xl sm:text-3xl font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
              MIDNIGHT CINEMA
            </div>
            <div className="text-amber-200/80 font-mono text-xs tracking-widest mt-1">
              CHANNEL 03 • VHS ARCHIVE
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 text-xs font-mono text-white/70">
              <span className="bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">STEREO</span>
              <span className="bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">HI-FI</span>
            </div>
          </div>
        </div>
      );
    }

    // Channel 4: Space Odyssey / Radar Telemetry
    return (
      <div className="absolute inset-0 bg-[#030708] flex flex-col items-center justify-center p-6 select-none overflow-hidden">
        {/* Radar concentric rings */}
        <div className="absolute w-[200px] h-[200px] rounded-full border border-emerald-500/25 flex items-center justify-center">
          <div className="w-[140px] h-[140px] rounded-full border border-emerald-500/20 flex items-center justify-center">
            <div className="w-[80px] h-[80px] rounded-full border border-emerald-500/30" />
          </div>
        </div>
        <div className="relative z-10 text-center">
          <div className="text-emerald-400 font-mono text-2xl sm:text-3xl font-black tracking-widest drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]">
            CHANNEL 04
          </div>
          <div className="text-emerald-300/80 font-mono text-xs tracking-widest mt-1">
            TELEMETRY & SPACE FEED
          </div>
          <div className="mt-3 text-emerald-500 font-mono text-xs">
            FREQ: 440.125 MHz [LOCKED]
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="absolute tv-crt-screen pointer-events-auto"
      style={{
        left: "11.093%",
        top: "10.736%",
        width: "77.894%",
        height: "54.113%",
      }}
    >
      {/* Screen Content Wrapper with CRT Power-on/off scale animation */}
      <div
        className={`w-full h-full relative overflow-hidden bg-black ${powerAnimationClass}`}
        style={{
          display: isPoweredOn || powerAnimationClass === "crt-power-off" ? "block" : "none",
        }}
      >
        {/* Channel switch flicker wrapper */}
        <div
          key={`channel-${channelSwitchKey}`}
          className="w-full h-full relative crt-channel-switch"
        >
          {/* HTML5 Video element */}
          {hasSource && (
            <video
              ref={videoRef}
              src={currentChannel.src}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                hasVideoLoaded ? "opacity-100 z-1" : "opacity-0"
              }`}
              playsInline
              preload="auto"
              loop
              onLoadedData={() => setHasVideoLoaded(true)}
              onError={() => setHasVideoLoaded(false)}
              onEnded={onVideoEnd}
            />
          )}

          {/* Fallback Retro Broadcast Screen when no video source is present or video is loading */}
          {(!hasSource || !hasVideoLoaded) && renderFallbackBroadcast()}

          {/* CRT Scanline overlay */}
          <div className="tv-crt-scanlines" />

          {/* Subtle phosphor micro-flicker */}
          <div className="absolute inset-0 tv-crt-flicker pointer-events-none z-3" />

          {/* Curved CRT Glass Glare and Vignette */}
          <div className="tv-crt-glare" />

          {/* Authentic 90s Vintage OSD */}
          <TvOSD osdState={osdState} isRecording={isRecording} />
        </div>
      </div>

      {/* When TV is turned off: pitch black tube surface */}
      {!isPoweredOn && powerAnimationClass !== "crt-power-off" && (
        <div className="absolute inset-0 bg-[#08090b] flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white/5" />
        </div>
      )}
    </div>
  );
};
