export interface ExternalLink {
  url?: string;
  label: string;
}
export interface ProfileLink extends ExternalLink {
  url: string;
  note: string;
}
export const links: Record<"github" | "telegram", ProfileLink> = {
  github: {
    url: "https://github.com/fil4tov",
    label: "github.com/fil4tov",
    note: "Мой GitHub — код и проекты.",
  },
  telegram: {
    url: "https://t.me/fil4tov",
    label: "Telegram",
    note: "Мой Telegram:",
  },
};

export const musicLinks: ExternalLink[] = [
  { label: "Яндекс Музыка", url: "https://music.yandex.ru/artist/25391727" },
  {
    label: "Spotify",
    url: "https://open.spotify.com/artist/11VLjSogr033zIysRwNTNy",
  },
  { label: "VK Музыка", url: "https://vk.ru/artist/4345114337870066697" },
  { label: "Звук", url: "https://zvuk.com/artist/214086011" },
];
