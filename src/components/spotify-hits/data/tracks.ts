// The songs on the page, in chart order. Spotify's all-time most-streamed songs, from the list it
// published for its 20th anniversary (April 2026).
//
// Adding a song: add an entry here and put its files in public/spotify-hits/<slug>/:
//   front, back, disc   the art, any size and format (.jpg .png .webp .avif), named front.jpg etc.;
//                       then run `npm run optimize:hits`, which makes front.webp 1100 × 1000 (the
//                       booklet), back.webp 1200 × 950 (the whole insert: 48 px spine | panel | spine)
//                       and disc.webp 1024 × 1024, and keeps the originals in art-src/ (not deployed)
//   audio.mp3           a 30–60 s clip of the song, 128–160 kbps, faded in and out (set `clip` to
//                       where it was cut from)
//   lyrics.lrc          time-synced lyrics ([mm:ss.xx] line), timed to the full song; `clip` lines
//                       them up
// then switch on the matching flags in `files`, and run `npm run check:hits` (the build runs it too,
// and stops if anything is missing, unoptimised or stray). Anything missing is drawn from `color`.
// The booklet's inside page and the tray side of the insert are always drawn: the album's colour as
// paper, with these details printed on it.
//
// Credits, albums, years and the facts in each blurb were checked against each song's Wikipedia
// article (October 2026). Stream counts are estimates from third-party trackers (late 2025) until
// they are replaced with Spotify's own figures.

export type ArtFile = "front.webp" | "back.webp" | "disc.webp";

export interface Track {
  rank: number;
  slug: string;
  title: string;
  mainArtist: string;
  featuring: string[];
  album: string;
  year: number;
  writers: string[];
  producers: string[];
  /** One line about the artist or the song. */
  blurb: string;
  streams: number | null;
  /** True while `streams` is an estimate, not Spotify's own figure. */
  streamsEstimated: boolean;
  streamsAsOf: string;
  /**
   * Where audio.mp3 was cut from the full song, in seconds (e.g. { start: 45, end: 105 }). Lyrics
   * are timed to the full song; this lines them up with the clip and keeps only the lines inside it.
   */
  clip?: { start: number; end: number };
  /** Base colour of the album: the sleeve's card, drawn art when an image is missing, the page tint. */
  color: string;
  /** The jewel case's disc tray: clear (the insert shows through round the disc) or black. */
  tray: "clear" | "black";
  /** Which files exist in public/spotify-hits/<slug>/. */
    files: { front: boolean; back: boolean; disc: boolean; audio: boolean; lyrics: boolean };
}

export const TRACKS: Track[] = [
  {
    rank: 1,
    slug: "blinding-lights",
    title: "Blinding Lights",
    mainArtist: "The Weeknd",
    featuring: [],
    album: "After Hours",
    year: 2019,
    writers: ["Abel Tesfaye", "Ahmad Balshe", "Jason Quenneville", "Max Martin", "Oscar Holter"],
    producers: ["Max Martin", "Oscar Holter", "The Weeknd"],
    blurb: "A synth-pop sprint through an empty city at night, and the most-streamed song in Spotify's history.",
    streams: 5200000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#0D0D0D",
    tray: "clear",
    files: {
      front: true,
      back: true,
      disc: true,
      audio: true,
      lyrics: true,
    },
    clip: { start: 11, end: 71 }
  },
  {
    rank: 2,
    slug: "shape-of-you",
    title: "Shape of You",
    mainArtist: "Ed Sheeran",
    featuring: [],
    album: "÷ (Divide)",
    year: 2017,
    writers: ["Ed Sheeran", "Steve Mac", "Johnny McDaid", "Kandi Burruss", "Tameka Cottle", "Kevin Briggs"],
    producers: ["Ed Sheeran", "Steve Mac"],
    blurb: "Written for Rihanna, kept for himself: a marimba loop that sat at No. 1 in over 30 countries.",
    streams: 4700000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#30B1DB",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: true,
      lyrics: true,
    },
    clip: { start: 0, end: 60 }
  },
  {
    rank: 3,
    slug: "sweater-weather",
    title: "Sweater Weather",
    mainArtist: "The Neighbourhood",
    featuring: [],
    album: "I Love You.",
    year: 2012,
    writers: ["Jesse Rutherford", "Zach Abels", "Jeremy Freedman"],
    producers: ["Justyn Pilbrow"],
    blurb: "A 2012 indie-rock slow burn that kept climbing for a decade on playlists and short videos.",
    streams: 4400000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#8b9099",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: false,
      lyrics: false,
    },
  },
  {
    rank: 4,
    slug: "starboy",
    title: "Starboy",
    mainArtist: "The Weeknd",
    featuring: ["Daft Punk"],
    album: "Starboy",
    year: 2016,
    writers: ["Abel Tesfaye", "Thomas Bangalter", "Guy-Manuel de Homem-Christo", "Jason Quenneville", "Martin McKinney", "Henry Walter"],
    producers: ["Daft Punk"],
    blurb: "The title track of The Weeknd's 2016 reinvention, co-written and produced by Daft Punk.",
    streams: 4300000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#E10430",
    tray: "clear",
    files: {
      front: true,
      back: true,
      disc: true,
      audio: true,
      lyrics: true,
    },
    clip: { start: 11, end: 71 }
  },
  {
    rank: 5,
    slug: "as-it-was",
    title: "As It Was",
    mainArtist: "Harry Styles",
    featuring: [],
    album: "Harry's House",
    year: 2022,
    writers: ["Harry Styles", "Tyler Johnson", "Kid Harpoon"],
    producers: ["Kid Harpoon", "Tyler Johnson"],
    blurb: "A bright, fast synth-pop song about change, and the longest-running UK No. 1 of 2022.",
    streams: 4200000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#75372C",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: true,
      lyrics: true,
    },
    clip: { start: 3, end: 63 }
  },
  {
    rank: 6,
    slug: "someone-you-loved",
    title: "Someone You Loved",
    mainArtist: "Lewis Capaldi",
    featuring: [],
    album: "Divinely Uninspired to a Hellish Extent",
    year: 2018,
    writers: ["Lewis Capaldi", "Benjamin Kohn", "Peter Kelleher", "Thomas Barnes", "Sam Roman"],
    producers: ["TMS"],
    blurb: "A piano ballad from Glasgow that became the UK's best-selling song of 2019.",
    streams: 4100000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#860300",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: false,
      lyrics: false,
    }
  },
  {
    rank: 7,
    slug: "sunflower",
    title: "Sunflower",
    mainArtist: "Post Malone",
    featuring: ["Swae Lee"],
    album: "Spider-Man: Into the Spider-Verse",
    year: 2018,
    writers: ["Austin Post", "Khalif Brown", "Carl Rosen", "Louis Bell", "Billy Walsh", "Carter Lang"],
    producers: ["Louis Bell", "Carter Lang"],
    blurb: "A laid-back duet made for Spider-Verse that spent 33 weeks in the Billboard Hot 100's top 10, a record at the time.",
    streams: 4000000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#010101",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: false,
      lyrics: false,
    }
  },
  {
    rank: 8,
    slug: "one-dance",
    title: "One Dance",
    mainArtist: "Drake",
    featuring: ["Wizkid", "Kyla"],
    album: "Views",
    year: 2016,
    writers: ["Aubrey Graham", "Ayodeji Balogun", "Kyla Smith", "Paul Jefferies", "Noah Shebib", "Errol Reid", "Luke Reid", "Corey Johnson", "Logan Sama"],
    producers: ["Nineteen85", "40", "Wizkid", "Sarz", "DJ Maphorisa"],
    blurb: "Dancehall and UK funky round a sample of Kyla's 2008 'Do You Mind', and Spotify's first song to a billion.",
    streams: 3900000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#808B8D",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: false,
      lyrics: false,
    }
  },
  {
    rank: 9,
    slug: "perfect",
    title: "Perfect",
    mainArtist: "Ed Sheeran",
    featuring: [],
    album: "÷ (Divide)",
    year: 2017,
    writers: ["Ed Sheeran"],
    producers: ["Ed Sheeran", "Will Hicks"],
    blurb: "A slow-dance ballad Ed Sheeran wrote about Cherry Seaborn, later his wife.",
    streams: 3850000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#30B1DB",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: true,
      lyrics: true,
    },
    clip: { start: 95, end: 155 }
  },
  {
    rank: 10,
    slug: "stay",
    title: "Stay",
    mainArtist: "The Kid LAROI",
    featuring: ["Justin Bieber"],
    album: "F*ck Love 3: Over You",
    year: 2021,
    writers: ["Charlton Howard", "Justin Bieber", "Magnus Høiberg", "Charlie Puth", "Omer Fedi", "Blake Slatkin", "Michael Mule", "Isaac De Boni", "Subhaan Rahmaan"],
    producers: ["Cashmere Cat", "Charlie Puth", "Omer Fedi", "Blake Slatkin"],
    blurb: "Two and a quarter minutes of breathless synth-pop, and one of the biggest songs of 2021.",
    streams: 3800000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    color: "#121116",
    tray: "clear",
    files: {
      front: true,
      back: false,
      disc: false,
      audio: true,
      lyrics: true,
    },
    clip: { start: 8, end: 68 }
  },
];

const BASE = "/spotify-hits";
export const fileUrl = (t: Track, file: ArtFile | "audio.mp3" | "lyrics.lrc") => `${BASE}/${t.slug}/${file}`;

export const artistLine = (t: Track) => (t.featuring.length ? `${t.mainArtist} · feat. ${t.featuring.join(", ")}` : t.mainArtist);

/** How long the song plays here: its clip (until audio.mp3 has loaded and says exactly); a minute without one. */
export const clipMs = (t: Track) => (t.clip ? Math.max(1, t.clip.end - t.clip.start) * 1000 : 60000);

export const formatTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const formatStreams = (n: number | null) => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  return `${Math.round(n / 1e6)}M`;
};
