import type { Metadata } from "next";
import SpotifyHits from "@/components/spotify-hits/SpotifyHits";
import { display, mono, sans } from "./fonts";

export const metadata: Metadata = {
  title: "Top 10 of all time — Spotify Top Hits",
  description: "Spotify's ten most-streamed songs of all time, as albums you can open and play.",
};

export default function SpotifyTopHitsPage() {
  return (
    <main className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <SpotifyHits />
    </main>
  );
}
