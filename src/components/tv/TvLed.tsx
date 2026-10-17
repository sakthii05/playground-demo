"use client";

import React, { useEffect, useState } from "react";

interface TvLedProps {
  isPoweredOn: boolean;
  pulseTrigger: number;
}

export const TvLed: React.FC<TvLedProps> = ({ isPoweredOn, pulseTrigger }) => {
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (pulseTrigger === 0) return;
    setIsPulsing(true);
    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, 280);
    return () => clearTimeout(timer);
  }, [pulseTrigger]);

  return (
    <div
      className="absolute pointer-events-none z-20 flex items-center justify-center"
      style={{
        left: "11.013%",
        top: "76.19%",
        width: "1.25%",
        height: "1.35%",
        transform: "translate(-50%, -50%)",
      }}
      aria-hidden="true"
    >
      <div
        className={`w-full h-full rounded-full transition-all duration-200 ${
          isPoweredOn
            ? isPulsing
              ? "operator-led-bulb operator-led-pulsing"
              : "operator-led-bulb"
            : "operator-led-off"
        }`}
      />
    </div>
  );
};
