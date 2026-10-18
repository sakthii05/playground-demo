"use client";

import React, { useState } from "react";
import { TVButtonType } from "./types";

interface TvButtonProps {
  type: TVButtonType;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TvButton: React.FC<TvButtonProps> = ({
  type,
  onClick,
  disabled = false,
  ariaLabel,
  className = "",
  style,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = () => {
    if (disabled) return;
    setIsPressed(true);
  };

  const handlePointerUp = () => {
    setIsPressed(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    onClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsPressed(true);
      onClick();
      setTimeout(() => setIsPressed(false), 120);
    }
  };

  // Render button inner content / icon
  const renderIcon = () => {
    switch (type) {
      case "stop":
        return (
          <svg className="w-[18%] h-[28%] max-w-[14px] max-h-[14px]" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="2" width="12" height="12" rx="1" fill="#e2e4e9" />
          </svg>
        );

      case "rew":
        return (
          <svg className="w-[28%] h-[28%] max-w-[20px] max-h-[14px]" viewBox="0 0 24 16" fill="currentColor">
            <path d="M11 2L2 8L11 14V2Z" fill="#e2e4e9" />
            <path d="M22 2L13 8L22 14V2Z" fill="#e2e4e9" />
          </svg>
        );

      case "play":
        return (
          <svg className="w-[20%] h-[28%] max-w-[15px] max-h-[14px]" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2L14 8L4 14V2Z" fill="#e2e4e9" />
          </svg>
        );

      case "ff":
        return (
          <svg className="w-[28%] h-[28%] max-w-[20px] max-h-[14px]" viewBox="0 0 24 16" fill="currentColor">
            <path d="M2 2L11 8L2 14V2Z" fill="#e2e4e9" />
            <path d="M13 2L22 8L13 14V2Z" fill="#e2e4e9" />
          </svg>
        );

      case "rec":
        return (
          <div className="w-[18%] aspect-square max-w-[14px] rounded-full bg-[#e62e2e] shadow-[0_0_3px_rgba(230,46,46,0.6),inset_0_1px_1px_rgba(255,200,200,0.8)] border border-[#a61515]" />
        );

      case "channel-up":
        return (
          <span className="text-[10px] sm:text-[11px] font-bold text-[#d2d5dc] tracking-wider flex items-center gap-0.5 select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            CH <span className="text-[8px] sm:text-[9px]">▲</span>
          </span>
        );

      case "channel-down":
        return (
          <span className="text-[10px] sm:text-[11px] font-bold text-[#d2d5dc] tracking-wider flex items-center gap-0.5 select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            CH <span className="text-[8px] sm:text-[9px]">▼</span>
          </span>
        );

      case "volume-down":
        return (
          <span className="text-sm sm:text-base font-bold text-[#d2d5dc] leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            −
          </span>
        );

      case "volume-up":
        return (
          <span className="text-sm sm:text-base font-bold text-[#d2d5dc] leading-none select-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            +
          </span>
        );

      case "power":
        return (
          <svg className="w-[42%] h-[42%] text-[#cfd3db] drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v10" />
            <path d="M18.4 6.6a9 9 0 1 1-12.77 0" />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={`${className} ${isPressed ? "is-pressed" : ""} ${
        disabled && type !== "power" ? "opacity-60 cursor-not-allowed" : ""
      }`}
      style={style}
    >
      {renderIcon()}
    </button>
  );
};
