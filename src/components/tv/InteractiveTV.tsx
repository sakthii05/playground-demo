"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { InteractiveTVProps, TVChannel, TVOSDState } from "./types";
import { TvScreen } from "./TvScreen";
import { TvButton } from "./TvButton";
import { TvLed } from "./TvLed";
import "./tv.css";

const DEFAULT_CHANNELS: TVChannel[] = [
  { id: 1, name: "Channel 01", src: "/videos/channel-01.mp4", genre: "Broadcast Feed" },
  { id: 2, name: "Channel 02", src: "/videos/channel-02.mp4", genre: "Cyberwave Synth" },
  { id: 3, name: "Channel 03", src: "/videos/channel-03.mp4", genre: "Midnight Cinema" },
  { id: 4, name: "Channel 04", src: "/videos/channel-04.mp4", genre: "Deep Space Radar" },
];

export const InteractiveTV: React.FC<InteractiveTVProps> = ({
  channels = DEFAULT_CHANNELS,
  defaultChannel = 1,
  defaultVolume = 0.7,
  autoPlay = true,
  className = "",
}) => {
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [currentChannelIndex, setCurrentChannelIndex] = useState(() => {
    const idx = channels.findIndex((c) => c.id === defaultChannel);
    return idx >= 0 ? idx : 0;
  });
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(defaultVolume);
  const [isRecording, setIsRecording] = useState(false);
  const [ledPulseTrigger, setLedPulseTrigger] = useState(0);
  const [channelSwitchKey, setChannelSwitchKey] = useState(0);

  const [osdState, setOsdState] = useState<TVOSDState>({
    visible: true,
    type: "channel",
    title: channels[0]?.name || "CH 01",
    subtitle: channels[0]?.genre,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const osdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Trigger Operator LED pulse on any interaction
  const triggerLedPulse = useCallback(() => {
    setLedPulseTrigger((prev) => prev + 1);
  }, []);

  // Display OSD with automatic fade-out
  const showOSD = useCallback(
    (type: TVOSDState["type"], options?: { title?: string; subtitle?: string; value?: number }, duration = 1800) => {
      if (osdTimerRef.current) {
        clearTimeout(osdTimerRef.current);
      }
      setOsdState({
        visible: true,
        type,
        title: options?.title,
        subtitle: options?.subtitle,
        value: options?.value,
      });

      osdTimerRef.current = setTimeout(() => {
        setOsdState((prev) => ({ ...prev, visible: false }));
      }, duration);
    },
    []
  );

  // Initial OSD on mount
  useEffect(() => {
    if (isPoweredOn) {
      showOSD("channel", {
        title: channels[currentChannelIndex]?.name,
        subtitle: channels[currentChannelIndex]?.genre,
      });
    }
  }, []);

  // Handle Power button
  const handlePowerToggle = useCallback(() => {
    triggerLedPulse();
    setIsPoweredOn((prev) => {
      const next = !prev;
      if (!next) {
        setIsPlaying(false);
        setIsRecording(false);
      } else {
        setIsPlaying(true);
        setTimeout(() => {
          showOSD("channel", {
            title: channels[currentChannelIndex]?.name,
            subtitle: channels[currentChannelIndex]?.genre,
          });
        }, 400);
      }
      return next;
    });
  }, [channels, currentChannelIndex, showOSD, triggerLedPulse]);

  // Handle Channel Up (wrapping: 4 -> 1)
  const handleChannelUp = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setChannelSwitchKey((k) => k + 1);
    setCurrentChannelIndex((prev) => {
      const next = (prev + 1) % channels.length;
      showOSD("channel", {
        title: channels[next]?.name,
        subtitle: channels[next]?.genre,
      });
      return next;
    });
    setIsPlaying(true);
  }, [channels, isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Channel Down (wrapping: 1 -> 4)
  const handleChannelDown = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setChannelSwitchKey((k) => k + 1);
    setCurrentChannelIndex((prev) => {
      const next = (prev - 1 + channels.length) % channels.length;
      showOSD("channel", {
        title: channels[next]?.name,
        subtitle: channels[next]?.genre,
      });
      return next;
    });
    setIsPlaying(true);
  }, [channels, isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Volume Up (+10%)
  const handleVolumeUp = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setVolume((prev) => {
      const next = Math.min(1, Math.round((prev + 0.1) * 10) / 10);
      showOSD("volume", { value: Math.round(next * 100) });
      return next;
    });
  }, [isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Volume Down (-10%)
  const handleVolumeDown = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setVolume((prev) => {
      const next = Math.max(0, Math.round((prev - 0.1) * 10) / 10);
      showOSD("volume", { value: Math.round(next * 100) });
      return next;
    });
  }, [isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Play/Pause
  const handlePlayToggle = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setIsPlaying((prev) => {
      const next = !prev;
      showOSD(next ? "play" : "pause");
      return next;
    });
  }, [isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Stop
  const handleStop = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    showOSD("stop");
  }, [isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Rewind (-10 seconds)
  const handleRewind = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
    showOSD("rewind");
  }, [isPoweredOn, showOSD, triggerLedPulse]);

  // Handle Fast Forward (+10 seconds)
  const handleFastForward = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    if (videoRef.current) {
      const dur = videoRef.current.duration || 1000;
      videoRef.current.currentTime = Math.min(dur, videoRef.current.currentTime + 10);
    }
    showOSD("fast-forward");
  }, [isPoweredOn, showOSD, triggerLedPulse]);

  // Handle REC Toggle
  const handleRecToggle = useCallback(() => {
    if (!isPoweredOn) return;
    triggerLedPulse();
    setIsRecording((prev) => !prev);
  }, [isPoweredOn, triggerLedPulse]);

  const currentChannel = channels[currentChannelIndex] || channels[0];

  return (
    <div
      className={`relative mx-auto select-none aspect-[1244/1155] ${className}`}
      style={{
        width: "min(100%, calc((100dvh - 110px) * 1244 / 1155))",
        maxWidth: "980px",
      }}
    >
      {/* ============================================================== */}
      {/* LAYER 1: CRT VIDEO & RETRO BROADCAST DISPLAY                   */}
      {/* ============================================================== */}
      <TvScreen
        currentChannel={currentChannel}
        isPoweredOn={isPoweredOn}
        isPlaying={isPlaying}
        volume={volume}
        isRecording={isRecording}
        osdState={osdState}
        channelSwitchKey={channelSwitchKey}
        videoRef={videoRef}
      />

      {/* ============================================================== */}
      {/* LAYER 2: PRIMARY TV FRAME IMAGE (Reference Image 1)             */}
      {/* ============================================================== */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <Image
          src="/image/tv/tv-base.webp"
          alt="Vintage CRT Television Frame"
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="pointer-events-none select-none"
        />
      </div>

      {/* ============================================================== */}
      {/* LAYER 3: INTERACTIVE PHYSICAL 3D BUTTONS                       */}
      {/* ============================================================== */}

      {/* 1. Main VCR Button Slot (STOP, REW, PLAY, FF, REC) */}
      <div
        className="absolute z-20 flex items-stretch gap-[2px] p-[2px]"
        style={{
          left: "17.122%",
          top: "76.104%",
          width: "56.672%",
          height: "6.667%",
        }}
      >
        {/* STOP */}
        <TvButton
          type="stop"
          onClick={handleStop}
          disabled={!isPoweredOn}
          ariaLabel="Stop video"
          className="flex-1 h-full vcr-button rounded-l-[18px] rounded-r-xs"
        />

        {/* REW */}
        <TvButton
          type="rew"
          onClick={handleRewind}
          disabled={!isPoweredOn}
          ariaLabel="Rewind 10 seconds"
          className="flex-1 h-full vcr-button rounded-xs"
        />

        {/* PLAY / PAUSE */}
        <TvButton
          type="play"
          onClick={handlePlayToggle}
          disabled={!isPoweredOn}
          ariaLabel={isPlaying ? "Pause video" : "Play video"}
          className="flex-1 h-full vcr-button rounded-xs"
        />

        {/* FF */}
        <TvButton
          type="ff"
          onClick={handleFastForward}
          disabled={!isPoweredOn}
          ariaLabel="Fast forward 10 seconds"
          className="flex-1 h-full vcr-button rounded-xs"
        />

        {/* REC */}
        <TvButton
          type="rec"
          onClick={handleRecToggle}
          disabled={!isPoweredOn}
          ariaLabel="Record toggle"
          className="flex-1 h-full vcr-button rounded-r-[18px] rounded-l-xs"
        />
      </div>

      {/* 2. Side Control: Channel Up (CH ▲) */}
      <div
        className="absolute z-20"
        style={{
          left: "85.209%",
          top: "73.593%",
          width: "8.923%",
          height: "2.944%",
        }}
      >
        <TvButton
          type="channel-up"
          onClick={handleChannelUp}
          disabled={!isPoweredOn}
          ariaLabel="Channel up"
          className="side-pill-button rounded-full w-full h-full"
        />
      </div>

      {/* 3. Side Control: Channel Down (CH ▼) */}
      <div
        className="absolute z-20"
        style={{
          left: "85.209%",
          top: "78.442%",
          width: "8.923%",
          height: "2.857%",
        }}
      >
        <TvButton
          type="channel-down"
          onClick={handleChannelDown}
          disabled={!isPoweredOn}
          ariaLabel="Channel down"
          className="side-pill-button rounded-full w-full h-full"
        />
      </div>

      {/* 4. Side Control: Volume Down (-) */}
      <div
        className="absolute z-20"
        style={{
          left: "83.521%",
          top: "83.896%",
          width: "5.788%",
          height: "2.944%",
        }}
      >
        <TvButton
          type="volume-down"
          onClick={handleVolumeDown}
          disabled={!isPoweredOn}
          ariaLabel="Volume down"
          className="side-pill-button rounded-l-full rounded-r-xs w-full h-full"
        />
      </div>

      {/* 5. Side Control: Volume Up (+) */}
      <div
        className="absolute z-20"
        style={{
          left: "89.791%",
          top: "83.896%",
          width: "5.788%",
          height: "2.944%",
        }}
      >
        <TvButton
          type="volume-up"
          onClick={handleVolumeUp}
          disabled={!isPoweredOn}
          ariaLabel="Volume up"
          className="side-pill-button rounded-r-full rounded-l-xs w-full h-full"
        />
      </div>

      {/* 6. Power Button */}
      <div
        className="absolute z-20"
        style={{
          left: "5.707%",
          top: "86.407%",
          width: "5.547%",
          height: "6.061%",
        }}
      >
        <TvButton
          type="power"
          onClick={handlePowerToggle}
          ariaLabel="Power"
          className="power-button w-full h-full"
        />
      </div>

      {/* ============================================================== */}
      {/* LAYER 4: OPERATE RED LED INDICATOR                             */}
      {/* ============================================================== */}
      <TvLed isPoweredOn={isPoweredOn} pulseTrigger={ledPulseTrigger} />
    </div>
  );
};
