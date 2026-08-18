import type { LibraryItem } from "./types";

let current: LibraryItem | null = null;

export function beginLibraryDrag(item: LibraryItem) {
  current = item;
}

export function endLibraryDrag() {
  current = null;
}

export function peekLibraryDrag(): LibraryItem | null {
  return current;
}
