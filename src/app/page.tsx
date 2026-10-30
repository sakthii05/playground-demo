import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Playground",
  description: "Small experiments in 3D, motion and interaction, built with Next.js.",
};

// Newest first. /tv is left out on purpose.
const PAGES = [
  {
    href: "/spotify-top-hits",
    title: "Spotify Top Hits",
    description: "Spotify's ten most-streamed songs as CD jewel cases in a 3D carousel. Open one, spin the disc, play the clip and follow the lyrics.",
    tags: ["R3F", "GSAP", "Web Audio"],
    date: "Oct 2026",
  },
  {
    href: "/pc-anatomy",
    title: "PC Anatomy",
    description: "A 3D gaming PC with an Intel Core Ultra 9 and an RTX 5080. Power it on, spin it round and take it apart.",
    tags: ["R3F", "Three.js"],
    date: "Oct 2026",
  },
  {
    href: "/hero/msd",
    title: "MSD Hero",
    description: "A hero section for MS Dhoni where a trail of smoke under the cursor reveals him in CSK yellow.",
    tags: ["R3F", "Shaders"],
    date: "Sep 2026",
  },
  {
    href: "/trace-drawing",
    title: "Trace Drawing",
    description: "Trace over a picture with pressure-sensitive strokes. Undo, redo, bring your own image and download what you drew.",
    tags: ["Canvas", "Motion"],
    date: "Sep 2026",
  },
  {
    href: "/stamps",
    title: "Digital Stamps",
    description: "India's iconic places as animated postage stamps. Shuffle the set and look closer with a magnifier.",
    tags: ["Motion"],
    date: "Sep 2026",
  },
  {
    href: "/window-shutter",
    title: "Window Shutter",
    description: "Drag a roller shutter up and down, and watch the room brighten as it opens.",
    tags: ["Motion", "Drag"],
    date: "Sep 2026",
  },
];

const PORTFOLIO = "https://sakthi-portfolio-mauve.vercel.app/";

export default function Home() {
  return (
    <main className="min-h-dvh bg-neutral-50 text-neutral-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 sm:py-16 lg:py-24">
        <header className="flex flex-col gap-6 border-b border-neutral-200 pb-10 sm:pb-14">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Playground · {String(PAGES.length).padStart(2, "0")} pages</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">Small experiments in 3D, motion and interaction.</h1>
          <p className="max-w-xl text-base text-pretty text-neutral-600 sm:text-lg">
            Ideas I wanted to see working, each built as a single page with Next.js. Pick one to open it.
          </p>
        </header>

        <ol className="divide-y divide-neutral-200 border-b border-neutral-200">
          {PAGES.map((page, i) => (
            <li key={page.href}>
              <Link
                href={page.href}
                className="group grid grid-cols-[2.5rem_1fr_auto] gap-x-3 gap-y-2 py-6 outline-none transition-colors hover:bg-white focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-neutral-900 sm:grid-cols-[3rem_14rem_1fr_auto] sm:gap-x-6 sm:px-4 sm:py-8"
              >
                <span className="pt-1 font-mono text-xs text-neutral-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-semibold tracking-tight sm:text-xl">{page.title}</span>
                  <span className="font-mono text-xs text-neutral-500">
                    {page.href} · {page.date}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="grid size-9 place-items-center self-start rounded-full border border-neutral-200 text-neutral-500 transition group-hover:border-neutral-900 group-hover:bg-neutral-900 group-hover:text-white sm:order-last"
                >
                  <svg viewBox="0 0 16 16" className="size-4 transition-transform group-hover:-rotate-45" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="col-start-2 col-end-4 flex flex-col gap-3 sm:col-start-3 sm:col-end-4 sm:row-start-1">
                  <span className="text-sm text-pretty text-neutral-600 sm:text-base">{page.description}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {page.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-600">
                        {tag}
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <footer className="flex flex-col gap-2 pt-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Created by{" "}
            <a href={PORTFOLIO} target="_blank" rel="noopener noreferrer" className="font-medium text-neutral-900 underline-offset-4 hover:underline">
              @sakthi
            </a>
          </p>
          <p className="font-mono text-xs">Next.js · Tailwind · React Three Fiber</p>
        </footer>
      </div>
    </main>
  );
}
