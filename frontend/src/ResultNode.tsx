import { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { errorFromBody, readJson } from "./http";
import { beginLibraryDrag, endLibraryDrag } from "./libraryDrag";
import { formatDuration, isAudioPath, isVideoPath } from "./media";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import ResizableMedia from "./ResizableMedia";
import { sendToResolve, toast } from "./toast";
import {
  defaultSheetRefSlots,
  modelCostLabel,
  isFluxEditModel,
  isMuseEditModel,
  pickSheetResolution,
  qualityChoices,
  sheetAnglesFromIdentity,
  sheetComposeModel,
  sheetR2iRefCap,
  sheetSlotPhrase,
  SHEET_FULL_BODY_RULE,
  SHEET_NO_TEXT,
  SHEET_REF_PACK,
  sizeChoices,
  SLOT_LABEL,
  sortSheetComposeModels,
  useSheetModels,
  type SheetAngleChip,
} from "./sheetUi";
import {
  writeLibraryPayload,
  type GenerateResponse,
  type ResultNodeData,
  type ToolKind,
} from "./types";

export type ResultFlowNode = Node<ResultNodeData, "result">;

export default function ResultNode({ data }: NodeProps<ResultFlowNode>) {
  const isSheet =
    data.slot === "sheet" ||
    data.sheetKind === "dress" ||
    data.sheetKind === "costume" ||
    data.sheetKind === "character" ||
    data.sheetKind === "scene" ||
    data.sheetKind === "prop";
  const models = useSheetModels();
  const [liveCompose, setLiveCompose] = useState<typeof models.r2i>([]);
  useEffect(() => {
    if (!isSheet) return;
    const ac = new AbortController();
    fetch("/models?mode=image&modality=r2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: typeof models.r2i }) => {
        const rows = Array.isArray(body.models) ? body.models.filter((m) => m?.id) : [];
        setLiveCompose(rows.filter(sheetComposeModel));
      })
      .catch((err: unknown) => {
        console.error("Sheet compose catalog load failed", err);
      });
    return () => ac.abort();
  }, [isSheet]);
  const sheetModels = useMemo(() => {
    const compose =
      liveCompose.length > 0
        ? liveCompose
        : Array.isArray(models.composeR2i) && models.composeR2i.length > 0
          ? models.composeR2i
          : models.r2i;
    const r2i = (Array.isArray(compose) ? compose : []).filter(
      (m) => m?.id && sheetComposeModel(m),
    );
    return sortSheetComposeModels(r2i);
  }, [liveCompose, models.composeR2i, models.r2i]);
  const [modelId, setModelId] = useState(
    data.modelId || data.r2iModel || data.t2iModel || "",
  );
  const selectedModel =
    sheetModels.find((m) => m.id === modelId) ||
    sheetModels.find((m) => m.id === (data.r2iModel || data.t2iModel)) ||
    sheetModels.find((m) => {
      const blob = `${m.id} ${m.label || ""}`.toLowerCase();
      return blob.includes("nano banana pro") && !blob.includes("t2i");
    }) ||
    sheetModels[0];
  const angleModel =
    selectedModel ||
    models.r2i.find((m) => m.id === data.r2iModel) ||
    models.t2i.find((m) => m.id === data.t2iModel);
  const liveSizes = isSheet ? sizeChoices(selectedModel) : [];
  const liveQuals = isSheet ? qualityChoices(selectedModel) : [];
  const dropVideoSize = (s: string) =>
    Boolean(s) && !/^(360p|480p|540p|720p|1080p|1440p|2160p)$/i.test(s);
  const sizeChoicesList = (
    isSheet && liveSizes.length ? liveSizes : Array.isArray(data.resolutionChoices) ? data.resolutionChoices : []
  ).filter(dropVideoSize);
  const [anglePrompt, setAnglePrompt] = useState(data.prompt || "");
  const [size, setSize] = useState(
    data.aspect ||
      (sizeChoicesList.includes(data.resolution || "") ? data.resolution : "") ||
      (isSheet ? pickSheetResolution(sizeChoicesList) : sizeChoicesList[0]) ||
      "",
  );
  const qualityOpts = (
    isSheet && liveQuals.length ? liveQuals : Array.isArray(data.qualityChoices) ? data.qualityChoices : []
  ).filter(Boolean);
  const [quality, setQuality] = useState(
    data.quality || qualityOpts[0] || "",
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState("");
  const [enhancingDraft, setEnhancingDraft] = useState(false);
  const [noLabels, setNoLabels] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [estimate, setEstimate] = useState("");
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [angleChips, setAngleChips] = useState<SheetAngleChip[]>([]);
  const [pickedSlots, setPickedSlots] = useState<string[]>([]);
  const pickedManualRef = useRef(false);
  const cap = isSheet ? sheetR2iRefCap(selectedModel) : Number(data.maxRefs) || 0;
  const isCharacterSheet =
    isSheet &&
    (data.sheetKind === "character" || (!data.sheetKind && data.slot === "sheet"));
  useEffect(() => {
    pickedManualRef.current = false;
  }, [data.assetId]);
  useEffect(() => {
    setAnglePrompt(data.prompt || "");
  }, [data.prompt]);
  useEffect(() => {
    if (data.aspect && data.aspect !== size) setSize(data.aspect);
  }, [data.aspect]);
  useEffect(() => {
    if (!isSheet || !liveSizes.length) return;
    setSize((cur) => {
      if (isMuseEditModel(selectedModel)) {
        const match = liveSizes.find((s) => /match|follow/i.test(s));
        if (/match|follow/i.test(cur) && liveSizes.includes(cur)) return cur;
        if (cur === "16:9" && liveSizes.includes("16:9")) return "16:9";
        return match || pickSheetResolution(liveSizes);
      }
      return liveSizes.includes(cur) ? cur : pickSheetResolution(liveSizes);
    });
    setQuality((cur) => (liveQuals.includes(cur) ? cur : liveQuals[0] || ""));
  }, [selectedModel?.id]);
  useEffect(() => {
    if (!data.generating) setBusy(false);
  }, [data.generating]);
  useEffect(() => {
    if (!isSheet || !selectedModel?.id) {
      setEstimate("");
      return;
    }
    const ac = new AbortController();
    const qs = new URLSearchParams({
      mode: "image",
      modality: "r2i",
      model_id: selectedModel.id,
      num_images: "1",
    });
    const aspect = size || data.aspect || "";
    const resolution = quality || data.resolution || "";
    if (aspect) qs.set("aspect", aspect);
    if (resolution) qs.set("resolution", resolution);
    fetch(`/estimate?${qs}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { ok?: boolean; cost?: string } | null) => {
        if (body?.cost && String(body.cost).includes("$")) {
          setEstimate(body.cost);
          return;
        }
        setEstimate("");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEstimate("");
      });
    return () => ac.abort();
  }, [isSheet, selectedModel?.id, size, quality, data.aspect, data.resolution]);
  useEffect(() => {
    if (!isCharacterSheet) {
      setAngleChips([]);
      return;
    }
    const previews = Array.isArray(data.refPreviews) ? data.refPreviews : [];
    const fromPreview: SheetAngleChip[] = previews
      .filter((c) => c.path)
      .map((c) => {
        const id = String(c.id || "").trim();
        const slot =
          SHEET_REF_PACK.find((s) => s === id) ||
          (Object.keys(SLOT_LABEL).find((s) => SLOT_LABEL[s] === c.label) || "");
        return {
          slot: slot || id || "front",
          label: c.label || SLOT_LABEL[slot] || slot || "Ref",
          path: c.path,
          url: c.url || "",
        };
      });
    let cancelled = false;
    const assetId = data.assetId || "";
    if (!assetId) {
      const extras = Array.isArray(data.extraRefs) ? data.extraRefs.filter(Boolean) : [];
      const paths = [data.sourceStill || "", ...extras].filter(Boolean);
      const fallback: SheetAngleChip[] = paths.map((path, i) => ({
        slot: SHEET_REF_PACK[i] || `ref_${i + 1}`,
        label: SLOT_LABEL[SHEET_REF_PACK[i] || ""] || `Ref ${i + 1}`,
        path,
        url: "",
      }));
      setAngleChips(fromPreview.length ? fromPreview : fallback);
      return;
    }
    fetch(`/assets/${assetId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { item?: { identity?: Record<string, string>; identity_urls?: Record<string, string> } } | null) => {
        if (cancelled) return;
        const item = body?.item;
        const fromIdent = sheetAnglesFromIdentity(item?.identity, item?.identity_urls);
        if (fromIdent.length) {
          setAngleChips(fromIdent);
          return;
        }
        const extras = Array.isArray(data.extraRefs) ? data.extraRefs.filter(Boolean) : [];
        const paths = [data.sourceStill || "", ...extras].filter(Boolean);
        setAngleChips(
          fromPreview.length
            ? fromPreview
            : paths.map((path, i) => ({
                slot: SHEET_REF_PACK[i] || `ref_${i + 1}`,
                label: SLOT_LABEL[SHEET_REF_PACK[i] || ""] || `Ref ${i + 1}`,
                path,
                url: "",
              })),
        );
      })
      .catch(() => {
        if (!cancelled) setAngleChips(fromPreview);
      });
    return () => {
      cancelled = true;
    };
  }, [isCharacterSheet, data.assetId, data.sourceStill, data.extraRefs, data.refPreviews]);
  useEffect(() => {
    if (!isCharacterSheet || !angleChips.length) return;
    const avail = angleChips.map((c) => c.slot);
    const def = defaultSheetRefSlots(avail, cap);
    setPickedSlots((cur) => {
      if (!pickedManualRef.current) return def;
      return cur.filter((s) => avail.includes(s));
    });
  }, [isCharacterSheet, cap, angleChips]);

  const result = data.result;
  const paths = (result.result_paths ?? []).length
    ? result.result_paths ?? []
    : localUrl
      ? [localUrl]
      : [];
  const local = result.local_paths ?? [];
  const copyPath = local[0] || "";
  const sample = paths[0] || copyPath;
  const isVid = Boolean(sample && isVideoPath(sample));
  const isAud = Boolean(sample && isAudioPath(sample));
  const tools: { id: ToolKind; label: string }[] = isAud
    ? []
    : isVid
      ? [
          { id: "upscale", label: "Upscale" },
          { id: "denoise", label: "Denoise" },
          { id: "restore", label: "Restore" },
          { id: "deblur", label: "Deblur" },
          { id: "interpolate", label: "Interpolate" },
        ]
      : [
          { id: "upscale", label: "Upscale" },
          { id: "restore", label: "Restore" },
          { id: "deblur", label: "Deblur" },
        ];

  async function runDraftEnhance() {
    const cache = (result.draft_cache_url || "").trim();
    if (!cache) {
      toast("No draft cache on this result.", true);
      return;
    }
    setEnhancingDraft(true);
    setLocalError(null);
    try {
      const res = await fetch("/draft-enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft_cache_url: cache,
          duration: result.duration_sec ? String(result.duration_sec) : null,
          model_id: data.modelId || result.model || result.model_key || "",
        }),
      });
      const body = (await readJson(res)) as GenerateResponse & { detail?: string };
      if (!res.ok || body.ok === false) {
        throw new Error(
          errorFromBody(body, body.error || "Draft enhance failed."),
        );
      }
      data.onDraftEnhance?.(body);
      toast(body.cost ? `Enhanced · ${body.cost}` : "Enhanced to full quality.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Draft enhance failed.";
      setLocalError(msg);
      toast(msg, true);
    } finally {
      setEnhancingDraft(false);
    }
  }

  async function copyLocal() {
    if (!copyPath) return;
    try {
      await navigator.clipboard.writeText(copyPath);
    } catch {
      window.prompt("Copy path:", copyPath);
    }
  }

  async function showInFolder() {
    if (!copyPath) return;
    await fetch("/library/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: copyPath }),
    });
  }

  const title = (data.title || "").trim() || "Result";
  const isAngle = Boolean(data.slot || data.builderId);
  const hasStill = paths.length > 0;
  const jobSource = data.compareSource;
  const hasJobSource = Boolean(
    jobSource &&
      (jobSource.url || jobSource.thumb_url || jobSource.path) &&
      jobSource.kind !== "video" &&
      jobSource.kind !== "audio",
  );
  const canCompare = hasJobSource && hasStill && !isVid && !isAud;

  function enlarge() {
    const src = paths[0] || "";
    if (!src) return;
    openLightbox({
      src,
      kind: isVid ? "video" : isAud ? "audio" : "image",
      title,
    });
  }

  function packedRefCount() {
    if (isCharacterSheet && angleChips.length) {
      return pickedSlots.filter((s) => angleChips.some((c) => c.slot === s)).length;
    }
    const extras = Array.isArray(data.extraRefs) ? data.extraRefs.filter(Boolean) : [];
    const packed: string[] = [];
    for (const p of [data.sourceStill || "", ...extras]) {
      if (p && !packed.includes(p)) packed.push(p);
    }
    return packed.length;
  }

  function toggleSheetRef(slot: string) {
    pickedManualRef.current = true;
    setPickedSlots((cur) =>
      cur.includes(slot) ? cur.filter((s) => s !== slot) : [...cur, slot],
    );
    setLocalError(null);
  }

  async function enhanceSheetPrompt() {
    const prompt = anglePrompt.trim();
    if (!prompt) {
      setLocalError("Sheet prompt is empty.");
      return;
    }
    const selected = angleChips.filter((c) => pickedSlots.includes(c.slot));
    const names = selected.map((c) => sheetSlotPhrase(c.slot)).join(" / ");
    setEnhancingPrompt(true);
    setLocalError(null);
    try {
      const res = await fetch("/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: [
            prompt,
            "",
            "[Rewrite this character-sheet prompt only.]",
            names
              ? `Panels to include (name each once, do not repeat a slot): ${names}.`
              : "",
            SHEET_FULL_BODY_RULE,
            "Keep identity and wardrobe lock. No gibberish labels.",
          ]
            .filter(Boolean)
            .join("\n"),
          model_id: selectedModel?.id || data.r2iModel || "",
          modality: "r2i",
          mode: "image",
        }),
      });
      const body = await readJson(res);
      const rewritten = String((body as { prompt?: string }).prompt || "").trim();
      if (!res.ok || !rewritten) {
        throw new Error(errorFromBody(body, "Enhance returned an empty reply."));
      }
      setAnglePrompt(rewritten);
      data.onPrompt?.(rewritten);
      toast("Sheet prompt enhanced.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enhance failed.";
      setLocalError(msg);
      toast(msg, true);
    } finally {
      setEnhancingPrompt(false);
    }
  }

  async function confirmSheet() {
    const assetId = data.assetId || "";
    if (!assetId) {
      setLocalError("Missing costume/character id — Generate first.");
      return;
    }
    try {
      const res = await fetch(`/assets/${assetId}/primary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_slot: "sheet" }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(errorFromBody(body, "Could not set sheet as primary."));
      setConfirmed(true);
      toast("Sheet set as primary still.");
      window.dispatchEvent(new Event("ams-assets-changed"));
      data.onConfirmSheet?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not set primary.";
      setLocalError(msg);
      toast(msg, true);
    }
  }

  async function runAngleJob(ev?: { preventDefault?: () => void; stopPropagation?: () => void }) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    if (busy || data.generating) return;
    const prompt = anglePrompt.trim();
    const slot = data.slot || "front";
    if (!prompt) {
      setLocalError("Angle prompt is empty.");
      return;
    }
    if (slot !== "front" && !data.sourceStill) {
      setLocalError(slot === "sheet" ? "Generate at least one angle first" : "Generate Front first");
      return;
    }
    const extras = Array.isArray(data.extraRefs) ? data.extraRefs.filter(Boolean) : [];
    const packed: string[] = [];
    if (isCharacterSheet && angleChips.length) {
      const selected = angleChips.filter((c) => pickedSlots.includes(c.slot));
      if (cap > 0 && selected.length > cap) {
        setLocalError(`This model allows ${cap} refs — deselect extras`);
        return;
      }
      if (!selected.length) {
        setLocalError("Select at least one angle still.");
        return;
      }
      for (const c of selected) {
        if (c.path && !packed.includes(c.path)) packed.push(c.path);
      }
    } else {
      for (const p of [data.sourceStill || "", ...extras]) {
        if (p && !packed.includes(p)) packed.push(p);
      }
    }
    const refCap = isSheet ? cap : Number(data.maxRefs) || 0;
    const sendRefs = packed;
    if (refCap > 0 && sendRefs.length > refCap) {
      setLocalError(
        isSheet
          ? `This model allows ${refCap} refs — deselect extras`
          : `This model allows at most ${refCap} reference images (got ${sendRefs.length}).`,
      );
      return;
    }
    setBusy(true);
    setLocalError(null);
    data.onBusy?.(true, null);
    const pickedAspect = size || data.aspect || "";
    const pickedQuality = quality || "";
    let failMsg: string | null = null;
    try {
      let assetId = data.assetId || "";
      if (!assetId && data.sheetKind === "dress") {
        if (!data.characterId || !data.costumeId) {
          throw new Error("Pick a Character and a Costume.");
        }
        const dressed = await fetch("/assets/dress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_id: data.characterId,
            costume_id: data.costumeId,
            name: data.name || "",
          }),
        });
        const draft = await readJson(dressed);
        const item = (draft.item || null) as { id?: string } | null;
        if (!dressed.ok || !item?.id) {
          throw new Error(errorFromBody(draft, "Dress draft failed."));
        }
        assetId = item.id;
      }
      if (!assetId) {
        const created = await fetch("/assets/sheet/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "character",
            name: data.name || "Character",
            fields: {},
            notes: "",
          }),
        });
        const draft = await readJson(created);
        const item = (draft.item || null) as { id?: string } | null;
        if (!created.ok || !item?.id) {
          throw new Error(
            errorFromBody(draft, "Could not create character draft."),
          );
        }
        assetId = item.id;
      }
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: assetId,
          slot,
          model_id: isSheet
            ? selectedModel?.id || data.r2iModel || data.t2iModel || ""
            : slot === "front" && !data.sourceStill
              ? data.t2iModel || ""
              : data.r2iModel || data.t2iModel || "",
          prompt: noLabels && isSheet && !prompt.includes("No text, no labels")
            ? `${prompt} ${SHEET_NO_TEXT}`
            : prompt,
          source_still: sendRefs[0] || data.sourceStill || "",
          extra_refs: sendRefs.slice(1),
          wardrobe: data.wardrobe || "",
          resolution: pickedQuality || pickedAspect || data.resolution || "",
          aspect: pickedAspect,
        }),
      });
      const body = await readJson(res);
      const item = (body.item || null) as {
        identity?: Record<string, string>;
        identity_urls?: Record<string, string>;
        still_path?: string;
        url?: string;
        prompt?: string;
        cost?: string;
      } | null;
      if (!res.ok || !item) {
        throw new Error(errorFromBody(body, "Generate failed."));
      }
      const path = item.identity?.[slot] || item.still_path || "";
      const url = item.identity_urls?.[slot] || item.url || "";
      const shown = url
        ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`
        : "";
      if (shown) setLocalUrl(shown);
      data.onGenerated?.({
        slot,
        assetId,
        path,
        url: shown,
        prompt: item.prompt || prompt,
        cost: item.cost,
        resolution: size || data.resolution,
      });
    } catch (err: unknown) {
      failMsg = err instanceof Error ? err.message : "Generate failed.";
      console.error("Angle generate failed", err);
      setLocalError(failMsg);
    } finally {
      setBusy(false);
      data.onBusy?.(false, failMsg);
    }
  }

  return (
    <div className="studio-node result-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <Handle type="source" position={Position.Right} className="node-handle" />
      <div className="node-header">
        <span>{title}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="meta">
          <span>
            {result.cost ||
              (data.generating
                ? "Generating…"
                : isSheet
                  ? estimate || modelCostLabel(selectedModel)
                  : "Cost: —")}
          </span>
          {result.duration_sec ? (
            <span>{formatDuration(result.duration_sec)}</span>
          ) : null}
        </p>
        <div className="media" onDoubleClick={enlarge}>
          {paths.map((src) =>
            isVideoPath(src) ? (
              <ResizableMedia key={src} id={`result-vid-${src}`} minHeight={140} defaultHeight={220} locked={busy || data.generating}>
              <video
                src={src}
                controls
                playsInline
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openLightbox({ src, kind: "video", title });
                }}
              />
              </ResizableMedia>
            ) : isAudioPath(src) ? (
              <audio key={src} src={src} controls />
            ) : (
              <div
                key={src}
                className="nodrag result-drag"
                draggable={Boolean(data.dragItem)}
                onDragStart={(event) => {
                  if (!data.dragItem) {
                    event.preventDefault();
                    return;
                  }
                  event.stopPropagation();
                  beginLibraryDrag(data.dragItem);
                  writeLibraryPayload(event.dataTransfer, data.dragItem);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => endLibraryDrag()}
              >
              <ResizableMedia id={`result-img-${src}`} minHeight={120} defaultHeight={220} locked={busy || data.generating}>
              <img
                src={src}
                alt="Generated result"
                draggable={false}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openLightbox({ src, kind: "image", title });
                }}
              />
              </ResizableMedia>
              </div>
            ),
          )}
          {paths.length === 0 ? (
            <p className="hint">
              {data.generating
                ? "Generating…"
                : isAngle
                  ? "Angle prompt ready. Click Generate."
                  : "No media paths returned."}
            </p>
          ) : null}
        </div>
        {isAngle ? (
          <>
            {isCharacterSheet && angleChips.length ? (
              <div className="ref-chip-row sheet-ref-picker">
                {angleChips.map((chip) => {
                  const on = pickedSlots.includes(chip.slot);
                  const src =
                    chip.url ||
                    (data.assetId
                      ? `/assets/${data.assetId}/still?slot=${chip.slot}`
                      : "");
                  return (
                    <button
                      key={`${chip.slot}-${chip.path}`}
                      type="button"
                      className={`ref-chip pickable ${on ? "pick-on" : "pick-off"}`}
                      disabled={data.generating || busy}
                      onClick={() => toggleSheetRef(chip.slot)}
                      title={on ? `Exclude ${chip.label}` : `Include ${chip.label}`}
                    >
                      <input type="checkbox" readOnly checked={on} tabIndex={-1} />
                      {src ? <img src={src} alt="" /> : <span className="sheet-angle-empty" />}
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
                <span className={packedRefCount() > (cap || 0) && cap > 0 ? "hint warn" : "hint"}>
                  {packedRefCount()} / {cap || "—"} refs
                </span>
              </div>
            ) : Array.isArray(data.refPreviews) && data.refPreviews.length ? (
              <div className="ref-chip-row">
                {data.refPreviews.map((chip) => (
                  <div key={`${chip.label}-${chip.path}`} className="ref-chip">
                    {chip.url ? <img src={chip.url} alt="" /> : <span className="sheet-angle-empty" />}
                    <span>{chip.label}</span>
                  </div>
                ))}
                <span className="hint">
                  {packedRefCount()} / {cap || "—"} refs
                </span>
              </div>
            ) : isSheet ? (
              <p className="hint">
                {packedRefCount()} / {cap || "—"} refs
              </p>
            ) : null}
            {isSheet && sheetModels.length ? (
              <label className="builder-field">
                <span className="field-label">Model (multi-ref edit)</span>
                <select
                  className="model"
                  value={selectedModel?.id || ""}
                  disabled={data.generating || busy}
                  onChange={(e) => {
                    setModelId(e.target.value);
                    data.onModel?.(e.target.value);
                  }}
                >
                  {sheetModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label || m.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {sizeChoicesList.length ? (
              <label className="builder-field">
                <span className="field-label">Aspect / size</span>
                <select
                  className="model"
                  value={sizeChoicesList.includes(size) ? size : sizeChoicesList[0]}
                  disabled={data.generating || busy}
                  onChange={(e) => {
                    setSize(e.target.value);
                    data.onResolution?.(e.target.value);
                  }}
                >
                  {sizeChoicesList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {!isSheet && isFluxEditModel(angleModel) ? (
                  <span className="hint">Auto only — 2K is not a Flux-edit field.</span>
                ) : null}
                {isSheet && isMuseEditModel(selectedModel) ? (
                  <span className="hint">
                    Match source follows layout (omits aspect_ratio); otherwise 16:9.
                    Up to 10 angle stills.
                  </span>
                ) : null}
              </label>
            ) : null}
            {qualityOpts.length ? (
              <label className="builder-field">
                <span className="field-label">Quality</span>
                <select
                  className="model"
                  value={qualityOpts.includes(quality) ? quality : qualityOpts[0]}
                  disabled={data.generating || busy}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  {qualityOpts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {isSheet ? (
              <label className="param">
                <span>
                  <input
                    type="checkbox"
                    checked={noLabels}
                    disabled={data.generating || busy}
                    onChange={(e) => setNoLabels(e.target.checked)}
                  />{" "}
                  No text / labels
                </span>
              </label>
            ) : null}
            <p className="estimate">
              {isSheet
                ? `${estimate || modelCostLabel(selectedModel)} · ${packedRefCount()} / ${cap || "—"} refs`
                : result.cost || "Est. cost: —"}
            </p>
            <label className="builder-field">
              <span className="field-label">{isSheet ? "Sheet prompt" : "Angle prompt"}</span>
              <textarea
                className="prompt nowheel"
                rows={4}
                value={anglePrompt}
                disabled={data.generating}
                onChange={(e) => {
                  setAnglePrompt(e.target.value);
                  data.onPrompt?.(e.target.value);
                }}
              />
            </label>
            <div className="prompt-actions">
              {isCharacterSheet ? (
                <button
                  type="button"
                  className="ghost nodrag enhance"
                  disabled={busy || data.generating || enhancingPrompt || !anglePrompt.trim()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => void enhanceSheetPrompt()}
                >
                  {enhancingPrompt ? "Enhancing…" : "Enhance"}
                </button>
              ) : null}
              <button
                type="button"
                className="generate nodrag"
                disabled={
                  busy ||
                  data.generating ||
                  (isCharacterSheet && cap > 0 && packedRefCount() > cap)
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => void runAngleJob(e)}
              >
                {busy || data.generating
                  ? "Generating…"
                  : hasStill
                    ? "Regenerate"
                    : "Generate"}
              </button>
              {isSheet && hasStill ? (
                <button
                  type="button"
                  className="ghost nodrag"
                  disabled={busy || confirmed}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => void confirmSheet()}
                >
                  {confirmed
                    ? "Primary ✓"
                    : data.sheetKind === "dress"
                      ? "Confirm (save variant sheet)"
                      : "Confirm (set primary)"}
                </button>
              ) : null}
            </div>
            {localError || data.error ? (
              <p className="hint warn" role="alert">
                {localError || data.error}
              </p>
            ) : null}
          </>
        ) : null}
        {result.is_draft && result.draft_cache_url ? (
          <div className="result-tools">
            <button
              type="button"
              className="generate nodrag"
              disabled={enhancingDraft || busy || data.generating}
              onClick={() => void runDraftEnhance()}
            >
              {enhancingDraft ? "Enhancing…" : "Enhance"}
            </button>
            <span className="hint">FLUX 3 draft preview — Enhance to full quality</span>
          </div>
        ) : null}
        <div className="result-tools">
          <button
            type="button"
            className="ghost nodrag"
            disabled={!canCompare}
            title={
              hasJobSource
                ? "Overlay this result on the job's source still"
                : "No source image on this job"
            }
            onClick={() => {
              if (!canCompare) return;
              data.onCompareSource?.();
            }}
          >
            Compare Source
          </button>
          {data.onTool && !isAngle
            ? tools.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="ghost nodrag"
                  onClick={() => data.onTool?.(t.id)}
                >
                  {t.label}
                </button>
              ))
            : null}
        </div>
        <div className="result-actions" hidden={isAngle && !hasStill}>
          {data.onApplyToPin && !isVid && !isAud ? (
            <button
              type="button"
              className="generate nodrag apply-pin"
              disabled={!copyPath && !data.dragItem?.path && !data.dragItem?.url}
              onClick={data.onApplyToPin}
            >
              {data.applyLabel || "Apply to pin"}
            </button>
          ) : null}
          <button type="button" className="ghost nodrag" disabled={!copyPath} onClick={showInFolder}>
            Show in folder
          </button>
          <button type="button" className="ghost nodrag" disabled={!copyPath} onClick={copyLocal}>
            Copy path
          </button>
          <button
            type="button"
            className="ghost nodrag"
            disabled={!copyPath}
            onClick={() =>
              void sendToResolve(copyPath, {
                type: isAudioPath(copyPath)
                  ? "audio"
                  : isVideoPath(copyPath)
                    ? "video"
                    : "image",
                cost: result.cost,
              })
            }
          >
            Send to Resolve
          </button>
        </div>
      </div>
    </div>
  );
}
