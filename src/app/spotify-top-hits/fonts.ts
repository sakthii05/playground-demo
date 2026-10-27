// Fonts for this page only. Spotify's own face (Spotify Mix) is not public, so: Figtree, the closest free
// geometric sans, for the interface; Bricolage Grotesque for big song titles; Geist Mono for numbers.
// Each sets a CSS variable the page's Tailwind classes read, so trying another face is a one-line swap.
import { Bricolage_Grotesque, Figtree, Geist_Mono } from "next/font/google";

export const sans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--sth-sans",
});

export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--sth-display",
});

export const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--sth-mono",
});

// Alternatives that suit the same layout:
//   sans:    Plus Jakarta Sans, DM Sans, Outfit
//   display: Instrument Serif (italic, for an editorial contrast), Unbounded
