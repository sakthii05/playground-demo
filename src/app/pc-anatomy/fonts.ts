// Fonts for this page only (not the site-wide Geist). Each one sets a CSS variable that
// pc-anatomy.css reads, so trying another face is a one-line swap here.
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";

// Headline and card titles: a calm, high-contrast serif with a good italic.
export const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--pca-display",
});

// Interface and body copy.
export const sans = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--pca-sans",
});

// Specs and the live readout.
export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--pca-mono",
});

// Alternatives that suit the same layout, if you want to try them:
//   display: Fraunces, Newsreader, DM Serif Display
//   sans:    Geist, Manrope, IBM Plex Sans
//   mono:    Geist Mono, IBM Plex Mono, Space Mono
