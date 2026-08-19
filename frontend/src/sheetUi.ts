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

export function sheetModel(row: ModelRow) {
  const blob = `${row.id} ${row.label}`.toLowerCase();
  return blob.includes("flux") || blob.includes("seedream") || blob.includes("nano");
}

export function useSheetModels() {
  const [t2i, setT2i] = useState<ModelRow[]>([]);
  const [r2i, setR2i] = useState<ModelRow[]>([]);
  const [t2iId, setT2iId] = useState("");
  const [r2iId, setR2iId] = useState("");
  useEffect(() => {
    const ac = new AbortController();
    fetch("/models?mode=image&modality=t2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = (body.models ?? []).filter(sheetModel);
        setT2i(rows);
        setT2iId((cur) => cur || body.default_id || rows[0]?.id || "");
      })
      .catch(() => undefined);
    fetch("/models?mode=image&modality=r2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = (body.models ?? []).filter(sheetModel);
        setR2i(rows);
        setR2iId((cur) => cur || body.default_id || rows[0]?.id || "");
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);
  return { t2i, r2i, t2iId, r2iId, setT2iId, setR2iId };
}

export function localSheetEstimate(
  kind: string,
  t2i: ModelRow | undefined,
  r2i: ModelRow | undefined,
  slots: string[],
) {
  const planned = slots.length ? slots : ["front"];
  let total = 0;
  planned.forEach((slot, i) => {
    const first = i === 0 || slot === "front";
    const costume = kind === "costume";
    const row = costume || !first ? r2i : t2i;
    const fallback = costume || !first ? 0.03 : 0.04;
    const usd = Number(row?.cost_estimate_usd);
    total += Number.isFinite(usd) && usd > 0 ? usd : fallback;
  });
  const n = planned.length;
  return `Est. cost: $${total.toFixed(2)} · ${n} still${n === 1 ? "" : "s"}`;
}

export function useSheetEstimate(
  kind: string,
  t2iId: string,
  r2iId: string,
  slots: string[],
  models?: { t2i: ModelRow[]; r2i: ModelRow[] },
) {
  const key = slots.join("|");
  const local = localSheetEstimate(
    kind,
    models?.t2i.find((m) => m.id === t2iId),
    models?.r2i.find((m) => m.id === r2iId),
    slots,
  );
  const [estimate, setEstimate] = useState(local);
  useEffect(() => {
    setEstimate(local);
    const ac = new AbortController();
    fetch("/assets/sheet/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        t2i_model_id: t2iId,
        r2i_model_id: r2iId,
        slots,
      }),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { cost?: string } | null) => {
        if (body?.cost && body.cost.includes("$")) setEstimate(body.cost);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => ac.abort();
  }, [kind, t2iId, r2iId, key, local]);
  return estimate;
}
