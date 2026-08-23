import { useEffect, useState } from "react";
import { errorFromBody, readJson } from "./http";
import { toast } from "./toast";
import { openLightbox } from "./lightbox";
import {
  CORE_SLOTS,
  COSTUME_PLATE_SLOTS,
  COSTUME_SHEET_SLOT,
  EXTRA_SLOTS,
  SLOT_LABEL,
  composeCostumeSheetPrompt,
  pickDefaultResolution,
  pickSheetResolution,
  qualityChoices,
  sheetR2iRefCap,
  sizeChoices,
  useSheetModels,
} from "./sheetUi";
import type { StudioAsset } from "./types";

type Props = {
  asset: StudioAsset;
  onClose: () => void;
  onChanged: (asset: StudioAsset) => void;
  onDress?: (characterId: string) => void;
  onUseRef?: (asset: StudioAsset) => void;
};

const ALL = [...CORE_SLOTS, ...EXTRA_SLOTS];

export default function AssetEditor({ asset, onClose, onChanged, onDress, onUseRef }: Props) {
  const [row, setRow] = useState(asset);
  const [name, setName] = useState(asset.name || "");
  const [notes, setNotes] = useState(asset.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSlot, setAddSlot] = useState("");
  const models = useSheetModels();

  useEffect(() => {
    let live = true;
    fetch(`/assets/${asset.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { item?: StudioAsset } | null) => {
        if (!live || !body?.item) return;
        setRow(body.item);
        setName(body.item.name || "");
        setNotes(body.item.notes || "");
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [asset.id]);

  const ident = row.identity_urls || {};
  const filled = ALL.filter((s) => ident[s] || row.identity?.[s]);
  const missing = ALL.filter((s) => !ident[s] && !row.identity?.[s]);
  const primary = row.primary_slot || "front";
  const isChar = row.kind === "character";
  const isCostume = row.kind === "costume";
  const hasSheet = Boolean(ident.sheet || row.identity?.sheet);
  const costumeAngles = filled.length;
  const canCostumeSheet = isCostume && costumeAngles >= 1;

  async function persistMeta() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/assets/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), notes: notes.trim() }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, "Update failed."));
      const item = body.item as StudioAsset;
      setRow(item);
      onChanged(item);
      toast("Saved.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Update failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary(slot: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/assets/${row.id}/primary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_slot: slot }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, "Could not set primary."));
      const item = body.item as StudioAsset;
      setRow(item);
      onChanged(item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not set primary.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  async function regen(slot: string) {
    setBusy(true);
    setError(null);
    try {
      const r2i = models.r2iId || models.t2iId;
      const t2i = models.t2iId;
      const front = row.identity?.front || "";
      const source = front;
      const rowModel = source ? r2i : t2i;
      const sizeRow = models.r2i.find((m) => m.id === r2i) || models.t2i.find((m) => m.id === t2i);
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: row.id,
          slot,
          model_id: rowModel,
          source_still: source,
          resolution: pickDefaultResolution(qualityChoices(sizeRow).length ? qualityChoices(sizeRow) : sizeChoices(sizeRow)),
          aspect: pickDefaultResolution(sizeChoices(sizeRow)),
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, `${slot} failed.`));
      const item = body.item as StudioAsset;
      setRow(item);
      onChanged(item);
      toast(`${SLOT_LABEL[slot] || slot} regenerated.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Regenerate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  async function generateCostumeSheet() {
    const refs: string[] = [];
    for (const slot of COSTUME_PLATE_SLOTS) {
      const p = row.identity?.[slot] || "";
      if (p && !refs.includes(p)) refs.push(p);
    }
    if (!refs.length) {
      setError("Generate at least one costume angle first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r2i = models.r2iId || models.t2iId;
      const sizeRow = models.r2i.find((m) => m.id === r2i) || models.t2i.find((m) => m.id === models.t2iId);
      const cap = sheetR2iRefCap(sizeRow);
      const packed = refs.slice(0, cap);
      const sizes = sizeChoices(sizeRow);
      const quals = qualityChoices(sizeRow);
      const sheetSize = pickSheetResolution(sizes);
      const outfit = row.fields?.wardrobe || row.name || "the costume";
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: row.id,
          slot: COSTUME_SHEET_SLOT,
          model_id: r2i,
          source_still: packed[0],
          extra_refs: packed.slice(1),
          prompt: composeCostumeSheetPrompt(outfit),
          wardrobe: outfit,
          resolution: pickDefaultResolution(quals) || sheetSize,
          aspect: sheetSize,
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, "Costume sheet failed."));
      const item = body.item as StudioAsset;
      setRow(item);
      onChanged(item);
      toast("Costume sheet saved as primary still.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Costume sheet failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="modal asset-editor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit asset"
      >
        <div className="node-header">
          <span>{row.label || row.name}</span>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="node-body">
          <label className="builder-field">
            <span className="field-label">Name</span>
            <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="builder-field">
            <span className="field-label">Notes</span>
            <textarea
              className="prompt nowheel"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="prompt-actions">
            <button type="button" className="ghost" disabled={busy} onClick={() => void persistMeta()}>
              Save name / notes
            </button>
            {onUseRef ? (
              <button
                type="button"
                className="ghost"
                onClick={() => onUseRef(row)}
              >
                Use as ref
              </button>
            ) : null}
            {isChar && !row.parent_id && onDress ? (
              <button type="button" className="ghost" onClick={() => onDress(row.id)}>
                Dress Character
              </button>
            ) : null}
            {canCostumeSheet ? (
              <button
                type="button"
                className="generate"
                disabled={busy}
                onClick={() => void generateCostumeSheet()}
              >
                {busy ? "Generating…" : hasSheet ? "Regenerate Costume Sheet" : "Generate Costume Sheet"}
              </button>
            ) : null}
          </div>
          {hasSheet ? (
            <p className="hint">Costume sheet is the primary Dress ref for this outfit.</p>
          ) : null}
          <p className="field-label">Angles</p>
          <div className="sheet-progress">
            {(hasSheet ? [COSTUME_SHEET_SLOT, ...filled] : filled).map((slot) => {
              const src = ident[slot] || row.url;
              return (
                <div key={slot} className="sheet-angle">
                  {src ? (
                    <img
                      src={src}
                      alt={slot}
                      onDoubleClick={() =>
                        openLightbox({ src, kind: "image", title: SLOT_LABEL[slot] || slot })
                      }
                    />
                  ) : (
                    <div className="sheet-angle-empty">{slot}</div>
                  )}
                  <span>
                    {SLOT_LABEL[slot] || slot}
                    {primary === slot ? " · primary" : ""}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy || primary === slot}
                    onClick={() => void setPrimary(slot)}
                  >
                    Set primary
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => void regen(slot)}
                  >
                    {busy ? "…" : "Regenerate"}
                  </button>
                </div>
              );
            })}
          </div>
          {missing.length ? (
            <div className="params">
              <label className="param">
                <span>Add angle</span>
                <select className="model" value={addSlot} onChange={(e) => setAddSlot(e.target.value)}>
                  <option value="">Choose…</option>
                  {missing.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABEL[s] || s}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="ghost"
                disabled={busy || !addSlot}
                onClick={() => {
                  const slot = addSlot;
                  setAddSlot("");
                  void regen(slot);
                }}
              >
                Generate
              </button>
            </div>
          ) : null}
          {error ? (
            <p className="hint warn" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
