import { useEffect, useState } from "react";
import { spawnAngleResult } from "./angleSpawn";
import { errorFromBody, readJson } from "./http";
import { toast } from "./toast";
import { openLightbox } from "./lightbox";
import {
  CORE_SLOTS,
  COSTUME_SHEET_SLOT,
  EXTRA_SLOTS,
  SLOT_LABEL,
  collectAssetSheetRefs,
  composeAnglePrompt,
  composeCharacterIdentity,
  composeCharacterSheetPrompt,
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
  onSheetOpened?: () => void;
};

const ALL = [...CORE_SLOTS, ...EXTRA_SLOTS];

export default function AssetEditor({ asset, onClose, onChanged, onDress, onUseRef, onSheetOpened }: Props) {
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
  const angleCount =
    costumeAngles ||
    collectAssetSheetRefs(row).length ||
    (row.still_path ? 1 : 0);
  const canCostumeSheet = isCostume && angleCount >= 1;
  const canCharacterSheet = isChar && angleCount >= 1;

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

  function spawnMissingAngle(slot: string) {
    const frontPath = row.identity?.front || "";
    if (slot !== "front" && !frontPath) {
      const msg = "Generate Front first.";
      setError(msg);
      toast(msg, true);
      return;
    }
    const t2iRow = models.t2i.find((m) => m.id === models.t2iId) || models.t2i[0];
    const r2iRow = models.r2i.find((m) => m.id === models.r2iId) || models.r2i[0];
    const frontT2i = slot === "front" && !frontPath;
    const sizeRow = frontT2i ? t2iRow : r2iRow;
    const sizes = sizeChoices(sizeRow);
    const quals = qualityChoices(sizeRow);
    const identText =
      row.fields?.identity_prompt ||
      composeCharacterIdentity(row.fields || {}, row.notes || "");
    try {
      spawnAngleResult({
        builderId: `lib-${row.id}`,
        slot,
        label: SLOT_LABEL[slot] || slot,
        prompt: composeAnglePrompt(slot, identText, { hasFront: Boolean(frontPath) }),
        generating: false,
        error: null,
        focus: true,
        assetId: row.id,
        sourceStill: slot === "front" ? "" : frontPath,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        name: row.name,
        wardrobe: row.fields?.wardrobe || "",
        fields: row.fields,
        resolution: pickDefaultResolution(quals.length ? quals : sizes),
        resolutionChoices: sizes,
        aspect: pickDefaultResolution(sizes),
        quality: pickDefaultResolution(quals),
        qualityChoices: quals,
        maxRefs: sheetR2iRefCap(sizeRow),
      });
      onClose();
      onSheetOpened?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not open Result node.";
      setError(msg);
      toast(msg, true);
    }
  }

  function openSheetNode() {
    const kind = isCostume ? "costume" : "character";
    const refs = collectAssetSheetRefs(row);
    if (!refs.length) {
      setError("Generate at least one angle first.");
      return;
    }
    const r2iRow =
      models.composeR2i.find((m) => m.id === models.r2iId) ||
      models.r2i.find((m) => m.id === models.r2iId) ||
      models.composeR2i[0] ||
      models.r2i[0];
    const r2iId = r2iRow?.id || models.r2iId || "";
    const cap = sheetR2iRefCap(r2iRow);
    const sizes = sizeChoices(r2iRow);
    const quals = qualityChoices(r2iRow);
    try {
      spawnAngleResult({
        builderId: `lib-${row.id}`,
        slot: COSTUME_SHEET_SLOT,
        label: kind === "costume" ? "Costume sheet" : "Character sheet",
        prompt:
          kind === "costume"
            ? composeCostumeSheetPrompt(row.fields?.wardrobe || row.name || "")
            : composeCharacterSheetPrompt(row.name || "character"),
        generating: false,
        error: null,
        focus: true,
        assetId: row.id,
        sourceStill: refs[0],
        extraRefs: refs.slice(1),
        refPreviews: ALL.filter((s) => row.identity?.[s]).map((s) => ({
          id: s,
          label: SLOT_LABEL[s] || s,
          path: row.identity?.[s] || "",
          url: ident[s] || "",
        })),
        t2iModel: models.t2iId,
        r2iModel: r2iId,
        modelId: r2iId,
        maxRefs: cap,
        resolution: pickDefaultResolution(quals) || pickSheetResolution(sizes),
        resolutionChoices: sizes,
        aspect: pickSheetResolution(sizes),
        quality: pickDefaultResolution(quals),
        qualityChoices: quals,
        name: row.name,
        wardrobe: row.fields?.wardrobe || "",
        sheetKind: kind,
      });
      onClose();
      onSheetOpened?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not open sheet node.";
      setError(msg);
      toast(msg, true);
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
                onClick={() => openSheetNode()}
              >
                {hasSheet ? "Regenerate Costume Sheet" : "Generate Costume Sheet"}
              </button>
            ) : null}
            {canCharacterSheet ? (
              <button
                type="button"
                className="generate"
                disabled={busy}
                onClick={() => openSheetNode()}
              >
                {hasSheet ? "Regenerate Character Sheet" : "Generate Character Sheet"}
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
                  spawnMissingAngle(slot);
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
