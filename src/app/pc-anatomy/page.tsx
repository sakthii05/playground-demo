import type { Metadata } from "next";
import PcAnatomy from "@/components/pc-anatomy/PcAnatomy";
import { mono, sans } from "./fonts";

export const metadata: Metadata = {
  title: "Inside the machine — PC Anatomy",
  description: "A 3D gaming PC with an Intel Core Ultra 9 and an NVIDIA RTX 5080. Power it on, spin it, take it apart.",
};

export default function PcAnatomyPage() {
  return (
    <main className={`${sans.variable} ${mono.variable}`}>
      <PcAnatomy />
    </main>
  );
}
