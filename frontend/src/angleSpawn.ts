import type { SheetAnglePatch } from "./types";

export const ANGLE_SPAWN_EVENT = "ams-spawn-angle";

export type AngleSpawnDetail = SheetAnglePatch & { builderId: string };

export function spawnAngleResult(detail: AngleSpawnDetail) {
  if (!detail.builderId) {
    throw new Error("Builder id missing — could not place the Result node.");
  }
  if (!detail.slot) {
    throw new Error("Angle slot missing — could not place the Result node.");
  }
  window.dispatchEvent(new CustomEvent(ANGLE_SPAWN_EVENT, { detail }));
}