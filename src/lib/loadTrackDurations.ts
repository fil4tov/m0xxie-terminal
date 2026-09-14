/** Read metadata in small batches without starting playback or retaining sources. */
export function loadTrackDurations(
  tracks: readonly { src: string }[],
  onDuration: (index: number, duration: number) => void,
) {
  let cursor = 0;
  let disposed = false;
  const pending = new Set<() => void>();
  function next() {
    if (disposed || cursor >= tracks.length) return;
    const index = cursor++;
    const audio = new Audio();
    audio.preload = "metadata";
    const cleanup = () => {
      clearTimeout(timeout);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("durationchange", loaded);
      audio.removeEventListener("error", finish);
      audio.removeAttribute("src");
      audio.load();
      pending.delete(cleanup);
    };
    const finish = () => {
      cleanup();
      next();
    };
    const loaded = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      if (!disposed) onDuration(index, audio.duration);
      finish();
    };
    const timeout = setTimeout(finish, 15000);
    pending.add(cleanup);
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("durationchange", loaded);
    audio.addEventListener("error", finish);
    audio.src = tracks[index].src;
    audio.load();
  }
  for (let i = 0; i < 3; i++) next();
  return () => {
    disposed = true;
    pending.forEach((cleanup) => cleanup());
  };
}
