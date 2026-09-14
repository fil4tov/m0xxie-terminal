const FADE_SECONDS = 0.04;

/** Smooth the actual audio signal; keep the user's saved volume separate. */
export function createAudioFader(element: HTMLAudioElement) {
  const context =
    typeof AudioContext === "undefined" ? null : new AudioContext();
  const gain = context?.createGain();
  const source = context?.createMediaElementSource(element);
  if (context && gain && source) {
    gain.gain.setValueAtTime(0, context.currentTime);
    source.connect(gain);
    gain.connect(context.destination);
    element.volume = 1;
  } else element.volume = 0;

  const now = () => context?.currentTime ?? performance.now() / 1000;
  let ramp = { from: 0, to: 0, start: now(), end: now() };
  let timer: ReturnType<typeof setTimeout> | undefined;
  function value() {
    const progress =
      ramp.end === ramp.start
        ? 1
        : Math.min(
            1,
            Math.max(0, (now() - ramp.start) / (ramp.end - ramp.start)),
          );
    return ramp.from + (ramp.to - ramp.from) * progress;
  }
  function hold() {
    clearTimeout(timer);
    const current = value();
    const time = now();
    gain?.gain.cancelScheduledValues(time);
    gain?.gain.setValueAtTime(current, time);
    if (!gain) element.volume = current;
    ramp = { from: current, to: current, start: time, end: time };
  }
  function silence() {
    hold();
    const time = now();
    gain?.gain.setValueAtTime(0, time);
    if (!gain) element.volume = 0;
    ramp = { from: 0, to: 0, start: time, end: time };
  }
  function fadeTo(target: number, complete?: () => void) {
    hold();
    if (ramp.from === target) {
      complete?.();
      return;
    }
    ramp.to = target;
    ramp.end = ramp.start + FADE_SECONDS;
    gain?.gain.linearRampToValueAtTime(target, ramp.end);
    function finish() {
      if (!gain) element.volume = value();
      // Wait for the audio clock, not just the JS timer, before cutting playback.
      if (
        now() + 0.000001 < ramp.end &&
        (!context || context.state === "running")
      ) {
        timer = setTimeout(finish, 5);
      } else complete?.();
    }
    if (!gain || complete) timer = setTimeout(finish, gain ? 48 : 5);
  }
  return {
    hold,
    silence,
    fadeTo,
    resume: () => context?.resume() ?? Promise.resolve(),
    dispose() {
      clearTimeout(timer);
      source?.disconnect();
      gain?.disconnect();
      void context?.close().catch(() => {});
    },
  };
}
