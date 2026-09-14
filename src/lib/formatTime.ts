export const formatTime = (value: number | null | undefined) =>
  value != null && Number.isFinite(value)
    ? `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`
    : "--:--";
