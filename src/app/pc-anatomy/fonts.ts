// Fonts for this page only (not the site-wide Geist). Each one sets a CSS variable that the
// page's Tailwind classes read (font-(family-name:--pca-sans)), so trying another face is a one-line swap here.
import { Inter_Tight, JetBrains_Mono } from "next/font/google";

// Headline, interface and body copy.
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
//   sans:    Geist, Manrope, IBM Plex Sans
//   mono:    Geist Mono, IBM Plex Mono, Space Mono
