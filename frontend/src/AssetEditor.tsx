import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { spawnAngleResult } from "./angleSpawn";
import { errorFromBody, readJson } from "./http";
import { peekLibraryDrag } from "./libraryDrag";
import { toast } from "./toast";
import { openLightbox } from "./lightbox";
import {
  CORE_SLOTS,
  COSTUME_SHEET_SLOT,
  EXTRA_SLOTS,
  SCENE_SHEET_SLOT,
  SCENE_SLOT_LABEL,
  SCENE_SLOTS,
  SLOT_LABEL,
  collectAssetSheetRefs,
  composeAnglePrompt,
  extraAngleR2iRow,
  composeCharacterIdentity,
  composeCharacterSheetPrompt,
  composeCostumeSheetPrompt,
  composeSceneSheetPrompt,
  composeSceneStill,
  pickDefaultResolution,
  pickSceneAspect,
  pickSheetResolution,
  qualityChoices,
  sceneSizeChoices,
  sheetR2iRefCap,
  sizeChoices,
  useSheetModels,
} from "./sheetUi";
import {
  hasLibraryPayload,
  parseLibraryPayload,
  type StudioAsset,
} from "./types";

type Props = {
  asset: StudioAsset;
  onClose: () => void;
  onChanged: (asset: StudioAsset) => void;
  onDress?: (characterId: string) => void;
  onUseRef?: (asset: StudioAsset) => void;
  onSheetOpened?: () => void;
};

const CHAR_ALL = [...CORE_SLOTS, ...EXTRA_SLOTS];

export default function AssetEditor({ asset, onClose, onChanged, onDress, onUseRef, onSheetOpened }: Props) {
  const [row, setRow] = useState(asset);
  const [name, setName] = useState(asset.name || "");
  const [notes, setNotes] = useState(asset.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addSlot, setAddSlot] = useState("");
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceSlotRef = useRef("");
  const models = useSheetModels();

  const isChar = row.kind === "character";
  const isCostume = row.kind === "costume";
  const isScene = row.kind === "scene";
  const slots = isScene ? [...SCENE_SLOTS] : CHAR_ALL;
  const slotLabel = (slot: string) =>
    (isScene ? SCENE_SLOT_LABEL[slot] : SLOT_LABEL[slot]) || slot;

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
  const filled = slots.filter((s) => ident[s] || row.identity?.[s]);
  const missing = slots.filter((s) => !ident[s] && !row.identity?.[s]);
  const primary = row.primary_slot || (isScene ? "hero" : "front");
  const hasSheet = Boolean(ident.sheet || row.identity?.sheet);
  const costumeAngles = filled.length;
  const angleCount =
    costumeAngles ||
    collectAssetSheetRefs(row).length ||
    (row.still_path ? 1 : 0);
  const canCostumeSheet = isCostume && angleCount >= 1;
  const canCharacterSheet = isChar && angleCount >= 1;
  const canSceneSheet = isScene && angleCount >= 1;
  const displaySlots = isScene
    ? hasSheet
      ? [SCENE_SHEET_SLOT, ...slots]
      : [...slots]
    : hasSheet
      ? [COSTUME_SHEET_SLOT, ...filled]
      : filled;

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
      const heroOrFront = isScene
        ? row.identity?.hero || ""
        : row.identity?.front || "";
      const source = slot === "hero" || slot === "front" ? heroOrFront : heroOrFront;
      const rowModel = source && slot !== "hero" && slot !== "front" ? r2i : source ? r2i : t2i;
      const sizeRow = models.r2i.find((m) => m.id === r2i) || models.t2i.find((m) => m.id === t2i);
      const fields = row.fields || {};
      const photoreal = String(fields.photoreal || "on").toLowerCase() !== "off";
      const prompt = isScene
        ? composeSceneStill(fields.prompt || row.notes || row.name || "", {
            slot,
            camera: slot === "hero" ? fields.camera : "",
            photoreal,
          })
        : undefined;
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: row.id,
          slot,
          model_id: rowModel,
          source_still: slot === "hero" || slot === "front" ? "" : source,
          prompt,
          resolution: pickDefaultResolution(
            qualityChoices(sizeRow).length ? qualityChoices(sizeRow) : sizeChoices(sizeRow),
          ),
          aspect: isScene
            ? pickSceneAspect(sceneSizeChoices(sizeRow))
            : pickDefaultResolution(sizeChoices(sizeRow)),
        }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, `${slot} failed.`));
      const item = body.item as StudioAsset;
      setRow(item);
      onChanged(item);
      toast(`${slotLabel(slot)} regenerated.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Regenerate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  async function replaceStill(slot: string, file?: File, path?: string) {
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("files", file);
        res = await fetch(`/assets/${row.id}/slot?slot=${encodeURIComponent(slot)}`, {
          method: "POST",
          body: fd,
        });
      } else if (path) {
        res = await fetch(`/assets/${row.id}/slot/path`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot, path }),
        });
      } else {
        throw new Error("Pick a still to replace.");
      }
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, "Replace still failed."));
      const item = body.item as StudioAsset;
      setRow(item);
      onChanged(item);
      toast(`${slotLabel(slot)} still replaced.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Replace still failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  function pickReplace(slot: string) {
    replaceSlotRef.current = slot;
    replaceRef.current?.click();
  }

  function onReplaceFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const slot = replaceSlotRef.current;
    if (file && slot) void replaceStill(slot, file);
  }

  function stillFromDrop(event: DragEvent): string | null {
    const item = peekLibraryDrag() || parseLibraryPayload(event.dataTransfer);
    const path = item?.path || "";
    return path || null;
  }

  function onDropReplace(event: DragEvent, slot: string) {
    event.preventDefault();
    event.stopPropagation();
    const path = stillFromDrop(event);
    if (!path) {
      toast("Drop an image still.", true);
      return;
    }
    void replaceStill(slot, undefined, path);
  }

  function spawnMissingAngle(slot: string) {
    const frontPath = isScene
      ? row.identity?.hero || row.identity?.sheet || row.still_path || ""
      : row.identity?.front || "";
    if (slot !== "front" && slot !== "hero" && !frontPath) {
      const msg = isScene ? "Generate Hero first." : "Generate Front first.";
      setError(msg);
      toast(msg, true);
      return;
    }
    const t2iRow = models.t2i.find((m) => m.id === models.t2iId) || models.t2i[0];
    const r2iRow = models.r2i.find((m) => m.id === models.r2iId) || models.r2i[0];
    const frontT2i = (slot === "front" || slot === "hero") && !frontPath;
    const spawnR2i =
      isChar && !frontT2i ? extraAngleR2iRow(slot, models.r2i, r2iRow) : r2iRow;
    const sizeRow = frontT2i ? t2iRow : spawnR2i;
    const sizes = isScene ? sceneSizeChoices(sizeRow) : sizeChoices(sizeRow);
    const quals = qualityChoices(sizeRow);
    const fields = row.fields || {};
    const photoreal = String(fields.photoreal || "on").toLowerCase() !== "off";
    const identText =
      row.fields?.identity_prompt ||
      composeCharacterIdentity(row.fields || {}, row.notes || "");
    const prompt = isScene
      ? composeSceneStill(fields.prompt || row.notes || row.name || "", {
          slot,
          camera: slot === "hero" ? fields.camera : "",
          photoreal,
        })
      : composeAnglePrompt(slot, identText, { hasFront: Boolean(frontPath) });
    try {
      spawnAngleResult({
        builderId: `lib-${row.id}`,
        slot,
        label: slotLabel(slot),
        prompt,
        generating: false,
        error: null,
        focus: true,
        assetId: row.id,
        sourceStill: slot === "front" || slot === "hero" ? "" : frontPath,
        t2iModel: models.t2iId,
        r2iModel: frontT2i
          ? models.r2iId || models.t2iId
          : spawnR2i?.id || models.r2iId || models.t2iId,
        modelId: frontT2i ? undefined : spawnR2i?.id || models.r2iId || models.t2iId,
        name: row.name,
        wardrobe: row.fields?.wardrobe || "",
        fields: row.fields,
        resolution: pickDefaultResolution(quals.length ? quals : sizes),
        resolutionChoices: sizes,
        aspect: isScene ? pickSceneAspect(sizes) : pickDefaultResolution(sizes),
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
    const kind = isCostume ? "costume" : isScene ? "scene" : "character";
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
    const sizes = isScene ? sceneSizeChoices(r2iRow) : sizeChoices(r2iRow);
    const quals = qualityChoices(r2iRow);
    const fields = row.fields || {};
    const photoreal = String(fields.photoreal || "on").toLowerCase() !== "off";
    const attached = (isScene ? SCENE_SLOTS : CHAR_ALL)
      .filter((s) => row.identity?.[s])
      .map((s) => ({
        id: s,
        label: slotLabel(s),
        path: row.identity?.[s] || "",
        url: ident[s] || "",
      }));
    try {
      spawnAngleResult({
        builderId: `lib-${row.id}`,
        slot: isScene ? SCENE_SHEET_SLOT : COSTUME_SHEET_SLOT,
        label: isScene
          ? "Scene sheet"
          : kind === "costume"
            ? "Costume sheet"
            : "Character sheet",
        prompt: isScene
          ? composeSceneSheetPrompt(
              fields.prompt || row.name || "this place",
              "",
              attached,
              { photoreal },
            )
          : kind === "costume"
            ? composeCostumeSheetPrompt(row.fields?.wardrobe || row.name || "")
            : composeCharacterSheetPrompt(row.name || "character"),
        generating: false,
        error: null,
        focus: true,
        assetId: row.id,
        sourceStill: refs[0],
        extraRefs: refs.slice(1),
        refPreviews: attached,
        t2iModel: models.t2iId,
        r2iModel: r2iId,
        modelId: r2iId,
        maxRefs: cap,
        resolution: pickDefaultResolution(quals) || pickSheetResolution(sizes),
        resolutionChoices: sizes,
        aspect: isScene ? pickSceneAspect(sizes) : pickSheetResolution(sizes),
        quality: pickDefaultResolution(quals),
        qualityChoices: quals,
        name: row.name,
        wardrobe: row.fields?.wardrobe || "",
        fields: row.fields,
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
        aria-label={isScene ? "Edit scene" : "Edit asset"}
        data-testid={isScene ? "scene-asset-editor" : "asset-editor"}
      >
        <div className="node-header">
          <span>{row.label || row.name}</span>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="node-body">
          <input
            ref={replaceRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onReplaceFile}
          />
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
            {canSceneSheet ? (
              <button
                type="button"
                className="generate"
                disabled={busy}
                onClick={() => openSheetNode()}
              >
                {hasSheet ? "Regenerate Scene Sheet" : "Generate Scene Sheet"}
              </button>
            ) : null}
          </div>
          {hasSheet && isCostume ? (
            <p className="hint">Costume sheet is the primary Dress ref for this outfit.</p>
          ) : null}
          {isScene ? (
            <p className="hint">
              Hero is the walk-in wide. Empty yellow thumbs replace a still (drop or click).
              Double-click a still to enlarge.
            </p>
          ) : null}
          <p className="field-label">Angles</p>
          <div className="sheet-progress">
            {displaySlots.map((slot) => {
              const src = ident[slot] || (slot === primary ? row.url : "") || "";
              const empty = !src;
              return (
                <div key={slot} className="sheet-angle">
                  {src ? (
                    <img
                      src={src}
                      alt={slot}
                      title="Double-click to enlarge"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        openLightbox({ src, kind: "image", title: slotLabel(slot) });
                      }}
                    />
                  ) : (
                    <div
                      className="sheet-angle-empty sheet-angle-replace"
                      role="button"
                      title="Replace still"
                      onClick={() => pickReplace(slot)}
                      onDragOver={(e) => {
                        if (peekLibraryDrag() || hasLibraryPayload(e.dataTransfer)) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }
                      }}
                      onDrop={(e) => onDropReplace(e, slot)}
                    >
                      Replace still
                    </div>
                  )}
                  <span>
                    {slotLabel(slot)}
                    {primary === slot ? (isScene ? " · primary Hero" : " · primary") : ""}
                  </span>
                  {empty ? (
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy}
                      onClick={() => spawnMissingAngle(slot)}
                    >
                      Generate
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost"
                        disabled={busy || primary === slot}
                        onClick={() => void setPrimary(slot)}
                      >
                        {isScene && slot === "hero" ? "Set primary Hero" : "Set primary"}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={busy}
                        onClick={() => void regen(slot)}
                      >
                        {busy ? "…" : "Regenerate"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {!isScene && missing.length ? (
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
