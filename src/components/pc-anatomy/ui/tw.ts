// Shared Tailwind bits for the PC Anatomy page: black on white, neutral hairlines, two fonts.
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const SANS = "font-(family-name:--pca-sans)";
export const MONO = "font-(family-name:--pca-mono) tabular-nums";
export const FOCUS = "focus-visible:outline-[1.5px] focus-visible:outline-offset-2 focus-visible:outline-neutral-950";
/** Side padding of the page; the panel lines up with it. */
export const GUTTER = "px-[clamp(16px,3.2vw,44px)]";
