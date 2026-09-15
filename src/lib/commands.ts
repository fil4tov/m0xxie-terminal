import {
  links,
  musicLinks,
  telegramLinks,
  type ExternalLink,
} from "../config";
import {
  FiHeadphones,
  FiHelpCircle,
  FiMusic,
  FiRotateCcw,
} from "react-icons/fi";
import { SiGithub, SiTelegram } from "react-icons/si";
export const commands = [
  { name: "github", description: "Код и проекты", Icon: SiGithub },
  { name: "telegram", description: "Мой Telegram", Icon: SiTelegram },
  { name: "music", description: "Музыка на площадках", Icon: FiHeadphones },
  { name: "player", description: "Включить кассетный плеер", Icon: FiMusic },
  { name: "help", description: "Все команды", Icon: FiHelpCircle },
  { name: "clear", description: "Очистить терминал", Icon: FiRotateCcw },
] as const;
export interface CommandResult {
  text: string;
  links?: readonly ExternalLink[];
  action?: "player" | "clear" | "myip";
}
export function resolveCommand(raw: string): CommandResult {
  const name = raw.trim().toLowerCase().replace(/^\//, "");
  if (name === "pwd") return { text: window.location.href };
  if (name === "ping") return { text: "pong" };
  if (name === "myip") return { text: "Определяю IP…", action: "myip" };
  if (name === "github")
    return { text: links.github.note, links: [links.github] };
  if (name === "telegram")
    return {
      text: "Мои Telegram ссылки:",
      links: [...telegramLinks],
    };
  if (name === "music")
    return {
      text: musicLinks.length
        ? "Моя музыка на площадках:"
        : "Ссылки на музыкальные площадки скоро появятся.\nА пока послушай треки через /player.",
      links: [...musicLinks],
    };
  if (name === "clear") return { text: "", action: "clear" };
  if (name === "player")
    return {
      text: "Подключаю FR–01…\nЛента загружена. Нажми «Воспроизвести», чтобы слушать.",
      action: "player",
    };
  if (name === "help")
    return {
      text: "Доступные команды:\n/github    — код и проекты\n/telegram  — мой Telegram\n/music     — музыка на площадках\n/player    — кассетный плеер\n/clear     — очистить экран\n\n↑ ↓ выбрать · Tab дополнить · Enter выполнить",
    };
  return {
    text: `Команда «${raw}» не найдена.\nВведи /, чтобы увидеть доступные команды.`,
  };
}
