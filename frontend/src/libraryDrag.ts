import type { LibraryItem, SlotAccept } from "./types";

let current: LibraryItem | null = null;
let clearTimer: number | null = null;

export function beginLibraryDrag(item: LibraryItem) {
  if (clearTimer != null) {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  current = item;
}

export function endLibraryDrag() {
  if (clearTimer != null) window.clearTimeout(clearTimer);
  // Drop fires after dragend in some browsers — keep the item briefly.
  clearTimer = window.setTimeout(() => {
    current = null;
    clearTimer = null;
  }, 80);
}

export function peekLibraryDrag(): LibraryItem | null {
  return current;
}

export function consumeLibraryDrag(): LibraryItem | null {
  const item = current;
  current = null;
  if (clearTimer != null) {
    window.clearTimeout(clearTimer);
    clearTimer = null;
  }
  return item;
}

export function slotAccepts(accept: SlotAccept, item: LibraryItem): boolean {
  const kind = (item.kind || "").toLowerCase();
  if (accept === "any") return kind === "image" || kind === "video";
  if (accept === "image") return kind === "image";
  if (accept === "video") return kind === "video";
  return false;
}

export function slotNeedLabel(accept: SlotAccept): string {
  if (accept === "video") return "This slot needs a video";
  if (accept === "image") return "This slot needs an image";
  return "This slot needs an image or video";
}
