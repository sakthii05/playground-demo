// Shared Tailwind bits for the Spotify Top Hits page: Spotify's dark greys and green, three fonts.
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const SANS = "font-(family-name:--sth-sans)";
export const DISPLAY = "font-(family-name:--sth-display)";
export const MONO = "font-(family-name:--sth-mono) tabular-nums";

// Spotify's palette: base, two raised surfaces, the green, and the two text greys.
export const C = {
  base: "#121212",
  surface: "#181818",
  raised: "#282828",
  green: "#1ed760",
  text: "#ffffff",
  subdued: "#b3b3b3",
};

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ed760]";
/** Side padding of the page. */
export const GUTTER = "px-[clamp(16px,3.2vw,44px)]";
