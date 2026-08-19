import type { SheetAnglePatch } from "./types";

export const ANGLE_SPAWN_EVENT = "ams-spawn-angle";
export const ANGLE_GENERATE_EVENT = "ams-generate-angle";

export type AngleSpawnDetail = SheetAnglePatch & {
  builderId: string;
  t2iModel?: string;
  r2iModel?: string;
  name?: string;
  fields?: Record<string, string>;
  wardrobe?: string;
  notes?: string;
};

export type AngleGenerateDetail = {
  builderId: string;
  slot: string;
  prompt?: string;
};

export function spawnAngleResult(detail: AngleSpawnDetail) {
  if (!detail.builderId) {
    throw new Error("Builder id missing — could not place the Result node.");
  }
  if (!detail.slot) {
    throw new Error("Angle slot missing — could not place the Result node.");
  }
  window.dispatchEvent(new CustomEvent(ANGLE_SPAWN_EVENT, { detail }));
}

export function requestAngleGenerate(detail: AngleGenerateDetail) {
  if (!detail.builderId || !detail.slot) {
    throw new Error("Missing builder or slot — cannot generate.");
  }
  window.dispatchEvent(new CustomEvent(ANGLE_GENERATE_EVENT, { detail }));
}