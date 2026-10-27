// The songs on the page, in chart order. Spotify's all-time most-streamed songs, from the list it
// published for its 20th anniversary (April 2026).
//
// Adding a song: add an entry here and a folder public/spotify-hits/<slug>/ with any of
//   front.webp   booklet front cover, 1200 × 1200 (also the blurred page background when open,
//                and the disc label when there is no disc.webp)
//   back.webp    the back insert as printed flat, 1500 × 1180: a 60 px spine at each side and the
//                1380 px back panel between them
//   disc.webp    the disc label, 1200 × 1200, round art filling the square
//   audio.mp3    the song, 128–192 kbps
//   lyrics.lrc   time-synced lyrics ([mm:ss.xx] line)
// then switch on the matching flag in `files`. Anything missing is drawn from the data in `color`.
// The booklet's inside page and the tray side of the insert are always drawn: the album's colour as
// paper, with these details printed on it.
//
// Credits are the commonly published songwriting and production credits; check them against the
// release before shipping. Stream counts are estimates from third-party trackers (late 2025) until
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
  durationMs: number;
  /** Base colour of the album: the sleeve's card, drawn art when an image is missing, the page tint. */
  color: string;
  /** The jewel case's disc tray: clear (the insert shows through round the disc) or black. */
  tray: "clear" | "black";
  /** Which files exist in public/spotify-hits/<slug>/. */
  files: { front: boolean; back: boolean; disc: boolean; audio: boolean; lyrics: boolean };
}

const NONE = { front: false, back: false, disc: false, audio: false, lyrics: false };

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
    durationMs: 200040,
    color: "#c4122f",
    tray: "clear",
    files: NONE,
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
    producers: ["Steve Mac", "Ed Sheeran", "Johnny McDaid"],
    blurb: "Written for Rihanna, kept for himself: a marimba loop that sat at No. 1 in over 30 countries.",
    streams: 4700000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    durationMs: 233713,
    color: "#3fa7d6",
    tray: "clear",
    files: NONE,
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
    durationMs: 240400,
    color: "#8b9099",
    tray: "clear",
    files: NONE,
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
    producers: ["Daft Punk", "Doc McKinney", "Cirkut", "The Weeknd"],
    blurb: "The Weeknd's reinvention, built with Daft Punk in one of their last studio collaborations.",
    streams: 4300000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    durationMs: 230453,
    color: "#d6154f",
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
    durationMs: 167303,
    color: "#e58aa2",
    tray: "clear",
    files: NONE,
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
    durationMs: 182161,
    color: "#e3a338",
    tray: "clear",
    files: NONE,
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
    blurb: "A laid-back duet made for Spider-Verse that outlived the film on the charts for years.",
    streams: 4000000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    durationMs: 158040,
    color: "#f0bf1a",
    tray: "clear",
    files: NONE,
  },
  {
    rank: 8,
    slug: "one-dance",
    title: "One Dance",
    mainArtist: "Drake",
    featuring: ["Wizkid", "Kyla"],
    album: "Views",
    year: 2016,
    writers: ["Aubrey Graham", "Paul Jefferies", "Noah Shebib", "Ayodeji Balogun", "Kyla Reid"],
    producers: ["Nineteen85", "Wizkid", "DJ Maphorisa"],
    blurb: "Dancehall and UK funky round a sample of Kyla's 2008 'Do You Mind', and Spotify's first song to a billion.",
    streams: 3900000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    durationMs: 173987,
    color: "#5d6d80",
    tray: "clear",
    files: NONE,
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
    blurb: "A waltz-time love song Ed Sheeran wrote for his wife, Cherry Seaborn.",
    streams: 3850000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    durationMs: 263400,
    color: "#2f7fbf",
    tray: "clear",
    files: NONE,
  },
  {
    rank: 10,
    slug: "stay",
    title: "Stay",
    mainArtist: "The Kid LAROI",
    featuring: ["Justin Bieber"],
    album: "F*ck Love 3: Over You",
    year: 2021,
    writers: ["Charlton Howard", "Justin Bieber", "Blake Slatkin", "Omer Fedi", "Charlie Puth", "Magnus Høiberg", "Michael Mule", "Isaac De Boni"],
    producers: ["Cashmere Cat", "Charlie Puth", "Blake Slatkin", "Omer Fedi", "FnZ"],
    blurb: "Two and a quarter minutes of breathless synth-pop, and one of the biggest songs of 2021.",
    streams: 3800000000,
    streamsEstimated: true,
    streamsAsOf: "2025-12",
    durationMs: 141805,
    color: "#e2703a",
    tray: "clear",
    files: NONE,
  },
];

const BASE = "/spotify-hits";
export const fileUrl = (t: Track, file: ArtFile | "audio.mp3" | "lyrics.lrc") => `${BASE}/${t.slug}/${file}`;

export const artistLine = (t: Track) => (t.featuring.length ? `${t.mainArtist} · feat. ${t.featuring.join(", ")}` : t.mainArtist);

export const formatTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const formatStreams = (n: number | null) => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  return `${Math.round(n / 1e6)}M`;
};
