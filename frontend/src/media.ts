export function extOf(path: unknown): string {
  if (typeof path !== "string" || !path) return "";
  const clean = path.split("?")[0].toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot) : "";
}

export function isVideoPath(path: unknown): boolean {
  return [".mp4", ".webm", ".mov", ".m4v"].includes(extOf(path));
}

export function isAudioPath(path: unknown): boolean {
  return [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus"].includes(
    extOf(path),
  );
}

export function formatDuration(sec: number | undefined): string {
  if (sec == null || Number.isNaN(sec)) return "—";
  if (sec < 10) return `${sec.toFixed(1)}s`;
  return `${Math.round(sec)}s`;
}
