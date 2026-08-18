import { toast } from "./toast";
import type { LibraryItem } from "./types";

const IMAGE_EXTS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
];
const VIDEO_EXTS = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"];
const AUDIO_EXTS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus"];
const ALLOWED_EXTS = new Set([...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS]);

function extOf(name: string): string {
  const clean = name.split("?")[0].toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot) : "";
}

export function isOsFileDrag(dt: DataTransfer | null | undefined): boolean {
  if (!dt) return false;
  const types = [...dt.types];
  if (types.includes("Files") || types.includes("application/x-moz-file")) {
    return true;
  }
  if (dt.items && [...dt.items].some((it) => it.kind === "file")) return true;
  return false;
}

export function filesFromDataTransfer(dt: DataTransfer): File[] {
  const out: File[] = [];
  if (dt.files && dt.files.length) {
    for (const file of dt.files) out.push(file);
  } else if (dt.items && dt.items.length) {
    for (const item of dt.items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (file) out.push(file);
    }
  }
  return out;
}

export function isAllowedMediaFile(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  ) {
    return true;
  }
  return ALLOWED_EXTS.has(extOf(file.name));
}

export async function importOsFiles(
  fileList: FileList | File[],
): Promise<LibraryItem[]> {
  const raw = Array.from(fileList);
  const files = raw.filter(isAllowedMediaFile);
  const skipped = raw.length - files.length;
  if (!files.length) {
    toast(
      skipped
        ? "That drop is not an image, video, or audio file."
        : "No files to import.",
      true,
    );
    return [];
  }
  const form = new FormData();
  for (const file of files) form.append("files", file);
  const res = await fetch("/library/import", { method: "POST", body: form });
  const body = (await res.json()) as {
    ok?: boolean;
    items?: LibraryItem[];
    errors?: string[];
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof body.detail === "string" ? body.detail : "Import failed.",
    );
  }
  if (body.errors?.length) {
    toast(body.errors.join(" · "), true);
  }
  if (skipped) {
    toast(`${skipped} file(s) skipped (not image/video/audio).`, true);
  }
  window.dispatchEvent(new Event("ams-library-imported"));
  return body.items ?? [];
}
