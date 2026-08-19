import { useEffect, useState } from "react";
import type { ModelRow } from "./types";

export const CORE_SLOTS = ["front", "side", "closeup"] as const;
export const EXTRA_SLOTS = [
  "back",
  "threequarter_front",
  "threequarter_back",
  "top",
] as const;

export const WARDROBE_M =
  "minimal form-fit neutral crew-neck tee and fitted trousers, simple shoes, no logos, no accessories";
export const WARDROBE_F =
  "minimal form-fit neutral tank and fitted trousers, simple shoes, no logos, no accessories";

export const SLOT_LABEL: Record<string, string> = {
  front: "Front",
  side: "Side",
  closeup: "Close-up",
  back: "Back",
  threequarter_front: "¾ front",
  threequarter_back: "¾ back",
  top: "Top",
};

function bit(v: string | undefined | null): string {
  return String(v ?? "").trim();
}

/** Client-side identity paragraph from dropdowns + wardrobe + notes. No API. */
export function composeCharacterIdentity(
  fields: Record<string, string>,
  notes = "",
): string {
  const parts: string[] = [];
  const gender = bit(fields.gender);
  const age = bit(fields.age);
  if (gender && age) parts.push(`${gender.toLowerCase()} in their ${age}`);
  else if (gender) parts.push(gender.toLowerCase());
  else if (age) parts.push(`adult in their ${age}`);
  const height = bit(fields.height);
  if (height) parts.push(`height: ${height}`);
  const weight = bit(fields.weight) || bit(fields.build);
  if (weight) parts.push(`build: ${weight}`);
  const body = bit(fields.body);
  if (body) parts.push(`body type: ${body}`);
  const hair = [
    bit(fields.hair_length),
    bit(fields.hair_style),
    bit(fields.hair_color),
  ].filter(Boolean);
  if (hair.length) parts.push(`hair: ${hair.join(", ")}`);
  const facial = bit(fields.facial_hair);
  if (facial) {
    parts.push(
      facial.toLowerCase() === "none"
        ? "clean-shaven, no facial hair"
        : `facial hair: ${facial}`,
    );
  }
  const eyes = bit(fields.eye_color);
  if (eyes) parts.push(`eyes: ${eyes}`);
  const skin = bit(fields.skin);
  if (skin) parts.push(`skin tone: ${skin}`);
  const face = bit(fields.face_shape);
  if (face) parts.push(`face shape: ${face}`);
  const nose = bit(fields.nose);
  if (nose) parts.push(`nose: ${nose}`);
  const jaw = bit(fields.jaw);
  if (jaw) parts.push(`jaw/chin: ${jaw}`);
  const wardrobe = bit(fields.wardrobe);
  if (wardrobe) parts.push(`wardrobe: ${wardrobe}`);
  let head = parts.join("; ");
  const extra = bit(notes);
  if (extra) head = head ? `${head}. Extra: ${extra}` : extra;
  return head || "photoreal adult person";
}

export function sheetModel(row: ModelRow | null | undefined) {
  if (!row || typeof row !== "object") return false;
  const blob = `${row.id || ""} ${row.label || ""}`.toLowerCase();
  return blob.includes("flux") || blob.includes("seedream") || blob.includes("nano");
}

function asModelRows(raw: unknown): ModelRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is ModelRow => Boolean(row && (row as ModelRow).id));
}

function pickModelId(cur: string, preferred: string | undefined, rows: ModelRow[]) {
  if (cur && rows.some((r) => r.id === cur)) return cur;
  if (preferred && rows.some((r) => r.id === preferred)) return preferred;
  return rows[0]?.id || "";
}

export function useSheetModels() {
  const [t2i, setT2i] = useState<ModelRow[]>([]);
  const [r2i, setR2i] = useState<ModelRow[]>([]);
  const [t2iId, setT2iIdRaw] = useState("");
  const [r2iId, setR2iIdRaw] = useState("");
  useEffect(() => {
    const ac = new AbortController();
    fetch("/models?mode=image&modality=t2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = asModelRows(body.models).filter(sheetModel);
        setT2i(rows);
        setT2iIdRaw((cur) => pickModelId(cur, body.default_id, rows));
      })
      .catch((err: unknown) => {
        console.error("T2I catalog load failed", err);
      });
    fetch("/models?mode=image&modality=r2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = asModelRows(body.models).filter(sheetModel);
        setR2i(rows);
        setR2iIdRaw((cur) => pickModelId(cur, body.default_id, rows));
      })
      .catch((err: unknown) => {
        console.error("R2I catalog load failed", err);
      });
    return () => ac.abort();
  }, []);
  const t2iSafe = t2i.some((r) => r.id === t2iId) ? t2iId : t2i[0]?.id || "";
  const r2iSafe = r2i.some((r) => r.id === r2iId) ? r2iId : r2i[0]?.id || "";
  return {
    t2i,
    r2i,
    t2iId: t2iSafe,
    r2iId: r2iSafe,
    setT2iId: (id: string) =>
      setT2iIdRaw(t2i.some((r) => r.id === id) ? id : t2i[0]?.id || ""),
    setR2iId: (id: string) =>
      setR2iIdRaw(r2i.some((r) => r.id === id) ? id : r2i[0]?.id || ""),
  };
}

export function localSheetEstimate(
  kind: string,
  t2i: ModelRow | undefined,
  r2i: ModelRow | undefined,
  slots: string[],
) {
  try {
    const planned = (Array.isArray(slots) ? slots : []).filter(Boolean);
    const list = planned.length ? planned : ["front"];
    let total = 0;
    list.forEach((slot, i) => {
      const first = i === 0 || slot === "front";
      const costume = kind === "costume";
      const row = costume || !first ? r2i : t2i;
      const fallback = costume || !first ? 0.03 : 0.04;
      const usd = Number(row?.cost_estimate_usd);
      total += Number.isFinite(usd) && usd > 0 ? usd : fallback;
    });
    if (!Number.isFinite(total)) return "Est. cost: —";
    const n = list.length;
    return `Est. cost: $${total.toFixed(2)} · ${n} still${n === 1 ? "" : "s"}`;
  } catch (err) {
    console.error("localSheetEstimate failed", err);
    return "Est. cost: —";
  }
}

export function useSheetEstimate(
  kind: string,
  t2iId: string,
  r2iId: string,
  slots: string[],
  models?: { t2i: ModelRow[]; r2i: ModelRow[] },
) {
  const key = Array.isArray(slots) ? slots.filter(Boolean).join("|") : "";
  let local = "Est. cost: —";
  try {
    const t2iRows = Array.isArray(models?.t2i) ? models.t2i : [];
    const r2iRows = Array.isArray(models?.r2i) ? models.r2i : [];
    local = localSheetEstimate(
      kind,
      t2iRows.find((m) => m && m.id === t2iId),
      r2iRows.find((m) => m && m.id === r2iId),
      Array.isArray(slots) ? slots : [],
    );
  } catch (err) {
    console.error("useSheetEstimate local failed", err);
    local = "Est. cost: —";
  }
  const [estimate, setEstimate] = useState(local || "Est. cost: —");
  useEffect(() => {
    setEstimate(local || "Est. cost: —");
    const ac = new AbortController();
    fetch("/assets/sheet/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        t2i_model_id: t2iId || "",
        r2i_model_id: r2iId || "",
        slots: Array.isArray(slots) ? slots.filter(Boolean) : ["front"],
      }),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { cost?: string } | null) => {
        if (body?.cost && String(body.cost).includes("$")) setEstimate(body.cost);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("sheet estimate failed", err);
        setEstimate("Est. cost: —");
      });
    return () => ac.abort();
  }, [kind, t2iId, r2iId, key, local]);
  return estimate || "Est. cost: —";
}
