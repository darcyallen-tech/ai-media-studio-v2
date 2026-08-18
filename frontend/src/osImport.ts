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
const RAW_EXTS = new Set([
  ".arw",
  ".cr2",
  ".cr3",
  ".nef",
  ".nrw",
  ".dng",
  ".raf",
  ".orf",
  ".rw2",
  ".pef",
  ".srw",
  ".raw",
  ".rwl",
  ".3fr",
  ".erf",
  ".kdc",
  ".mos",
  ".mef",
  ".mrw",
  ".sr2",
  ".x3f",
]);

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
  // Explorer often reports no types until drop — treat unknown as possible files.
  if (types.length === 0) return true;
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

export function isRawFile(file: File): boolean {
  return RAW_EXTS.has(extOf(file.name));
}

export function isAllowedMediaFile(file: File): boolean {
  if (isRawFile(file)) return false;
  const ext = extOf(file.name);
  if (ext) return ALLOWED_EXTS.has(ext);
  const mime = (file.type || "").toLowerCase();
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  );
}

export async function importOsFiles(
  fileList: FileList | File[],
): Promise<LibraryItem[]> {
  const raw = Array.from(fileList);
  if (!raw.length) {
    toast("No files to import.", true);
    return [];
  }
  const rejected = raw.filter((f) => isRawFile(f) || !isAllowedMediaFile(f));
  const files = raw.filter(isAllowedMediaFile);
  if (rejected.some(isRawFile)) {
    toast("Unsupported format", true);
  } else if (rejected.length && !files.length) {
    toast("Unsupported format", true);
  }
  if (!files.length) {
    console.error("Library import rejected", rejected.map((f) => f.name));
    return [];
  }
  try {
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
      const msg =
        typeof body.detail === "string" ? body.detail : "Import failed.";
      console.error("Library import failed", res.status, body);
      throw new Error(msg);
    }
    if (body.errors?.length) {
      console.error("Library import errors", body.errors);
      toast(body.errors.join(" · "), true);
    }
    window.dispatchEvent(new Event("ams-library-imported"));
    return body.items ?? [];
  } catch (err) {
    console.error("Library import failed", err);
    throw err;
  }
}
