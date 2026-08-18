export type GridSnap = "off" | "fine" | "medium" | "coarse";
export type EdgeStyle = "curved" | "straight";

export const SNAP_KEY = "ams-grid-snap";
export const EDGE_KEY = "ams-edge-style";

/** Visible canvas dots are 22px; snap steps stay in that family. */
export const GRID_DOT = 22;

export const SNAP_STEPS: Record<Exclude<GridSnap, "off">, number> = {
  fine: GRID_DOT,
  medium: GRID_DOT * 2,
  coarse: GRID_DOT * 3,
};

export function normalizeSnap(value: unknown): GridSnap {
  const v = String(value || "").trim().toLowerCase();
  if (v === "off" || v === "fine" || v === "medium" || v === "coarse") return v;
  return "fine";
}

export function normalizeEdgeStyle(value: unknown): EdgeStyle {
  return value === "straight" ? "straight" : "curved";
}

export function readStoredSnap(): GridSnap {
  try {
    return normalizeSnap(localStorage.getItem(SNAP_KEY));
  } catch {
    return "fine";
  }
}

export function readStoredEdgeStyle(): EdgeStyle {
  try {
    return normalizeEdgeStyle(localStorage.getItem(EDGE_KEY));
  } catch {
    return "curved";
  }
}

export function storeSnap(value: GridSnap) {
  try {
    localStorage.setItem(SNAP_KEY, value);
  } catch {
    /* ignore */
  }
}

export function storeEdgeStyle(value: EdgeStyle) {
  try {
    localStorage.setItem(EDGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function snapGridFor(snap: GridSnap): [number, number] | null {
  if (snap === "off") return null;
  const n = SNAP_STEPS[snap];
  return [n, n];
}
