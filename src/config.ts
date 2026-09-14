export interface ProfileLink {
  url: string;
  label: string;
  note: string;
}
export interface Track {
  title: string;
  artist: string;
  src: string;
  duration: number;
}
export const links: Record<"github" | "bandcamp", ProfileLink> = {
  github: {
    url: "https://github.com/",
    label: "github.com",
    note: "Демоссылка — персональный профиль будет здесь.",
  },
  bandcamp: {
    url: "https://bandcamp.com/",
    label: "bandcamp.com",
    note: "Демоссылка — страница артиста будет здесь.",
  },
};
export const tracks: readonly Track[] = [
  {
    title: "better",
    artist: "m0xxie",
    src: "/audio/m0xxie - better.mp3",
    duration: 240,
  },
  {
    title: "free my mind",
    artist: "m0xxie",
    src: "/audio/m0xxie - free my mind.wav",
    duration: 215,
  },
  {
    title: "voyage",
    artist: "m0xxie",
    src: "/audio/m0xxie - voyage.mp3",
    duration: 357,
  },
];
