import { readdirSync } from "node:fs";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import type { Plugin } from "vite";
import { parseFile } from "music-metadata";

const audioExtension = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i;
const moduleId = "virtual:audio-library";
const resolvedId = `\0${moduleId}`;

export async function readAudioLibrary(directory: string, base = "/") {
  function scan(folder: string): string[] {
    try {
      return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const path = join(folder, entry.name);
        if (entry.isDirectory()) return scan(path);
        return entry.isFile() && audioExtension.test(entry.name) ? [path] : [];
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  const files = scan(join(directory, "audio")).sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
  const tracks = [];
  for (const file of files) {
    let duration: number | null = null;
    try {
      const metadata = await parseFile(file, {
        duration: true,
        skipCovers: true,
      });
      const seconds = metadata.format.duration;
      if (seconds !== undefined && Number.isFinite(seconds) && seconds > 0)
        duration = seconds;
    } catch {
      // Keep unreadable tracks listed; playback can report a media error later.
    }
    if (duration === null)
      console.warn(`[audio-library] Could not determine duration: ${file}`);
    tracks.push({
      title: basename(file, extname(file)),
      artist: "m0xxie",
      src: `${base.replace(/\/$/, "")}/${relative(directory, file).split(sep).map(encodeURIComponent).join("/")}`,
      duration,
    });
  }
  return tracks;
}

export function audioLibraryPlugin(): Plugin {
  let publicDirectory: string;
  let audioDirectory: string;
  let base: string;
  return {
    name: "audio-library",
    configResolved(config) {
      publicDirectory = resolve(config.publicDir);
      audioDirectory = join(publicDirectory, "audio");
      base = config.base;
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    async load(id) {
      if (id === resolvedId)
        return `export default ${JSON.stringify(await readAudioLibrary(publicDirectory, base))};`;
    },
    configureServer(server) {
      const onChange = (file: string) => {
        const path = relative(audioDirectory, resolve(file));
        if (
          path.startsWith(`..${sep}`) ||
          isAbsolute(path) ||
          !audioExtension.test(path)
        )
          return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add(audioDirectory);
      server.watcher
        .on("add", onChange)
        .on("unlink", onChange)
        .on("change", onChange);
      server.httpServer?.once("close", () => {
        server.watcher
          .off("add", onChange)
          .off("unlink", onChange)
          .off("change", onChange);
      });
    },
  };
}
