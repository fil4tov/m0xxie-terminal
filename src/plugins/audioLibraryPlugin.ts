import { readdirSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";

const audioExtension = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm)$/i;
const moduleId = "virtual:audio-library";
const resolvedId = `\0${moduleId}`;

export function readAudioLibrary(directory: string, base = "/") {
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
  return scan(directory)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((file) => ({
      title: basename(file, extname(file)),
      artist: "m0xxie",
      src: `${base.replace(/\/$/, "")}/${relative(directory, file).split(sep).map(encodeURIComponent).join("/")}`,
    }));
}

export function audioLibraryPlugin(): Plugin {
  let publicDirectory: string;
  let base: string;
  return {
    name: "audio-library",
    configResolved(config) {
      publicDirectory = resolve(config.publicDir);
      base = config.base;
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId)
        return `export default ${JSON.stringify(readAudioLibrary(publicDirectory, base))};`;
    },
    configureServer(server) {
      const onChange = (file: string) => {
        const path = relative(publicDirectory, resolve(file));
        if (path.startsWith("..") || !audioExtension.test(path)) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add(publicDirectory);
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
