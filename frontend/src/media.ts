export function extOf(path: string): string {
  const clean = path.split("?")[0].toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot) : "";
}

export function isVideoPath(path: string): boolean {
  return [".mp4", ".webm", ".mov", ".m4v"].includes(extOf(path));
}

export function isAudioPath(path: string): boolean {
  return [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus"].includes(
    extOf(path),
  );
}

export function formatDuration(sec: number | undefined): string {
  if (sec == null || Number.isNaN(sec)) return "—";
  if (sec < 10) return `${sec.toFixed(1)}s`;
  return `${Math.round(sec)}s`;
}
