import { links, type ProfileLink } from "../config";
import { FiHelpCircle, FiMusic, FiRotateCcw } from "react-icons/fi";
import { SiBandcamp, SiGithub } from "react-icons/si";
export const commands = [
  { name: "github", description: "Код и проекты", Icon: SiGithub },
  { name: "bandcamp", description: "Релизы и музыка", Icon: SiBandcamp },
  { name: "listen", description: "Включить кассетный плеер", Icon: FiMusic },
  { name: "help", description: "Все команды", Icon: FiHelpCircle },
  { name: "clear", description: "Очистить терминал", Icon: FiRotateCcw },
] as const;
export interface CommandResult {
  text: string;
  link?: ProfileLink;
  action?: "listen" | "clear";
}
export function resolveCommand(raw: string): CommandResult {
  const name = raw.trim().toLowerCase().replace(/^\//, "");
  if (name === "pwd") return { text: window.location.href };
  if (name === "github" || name === "bandcamp")
    return { text: links[name].note, link: links[name] };
  if (name === "clear") return { text: "", action: "clear" };
  if (name === "listen")
    return {
      text: "Подключаю FR–01…\nЛента загружена. Нажми «Воспроизвести», чтобы слушать.",
      action: "listen",
    };
  if (name === "help")
    return {
      text: "Доступные команды:\n/github    — код и проекты\n/bandcamp  — релизы и музыка\n/listen    — кассетный плеер\n/clear     — очистить экран\n\n↑ ↓ выбрать · Tab дополнить · Enter выполнить",
    };
  return {
    text: `Команда «${raw}» не найдена.\nВведи /, чтобы увидеть доступные команды.`,
  };
}
