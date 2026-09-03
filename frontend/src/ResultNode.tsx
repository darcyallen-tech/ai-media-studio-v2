import { useEffect, useMemo, useRef, useState } from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { errorFromBody, readJson } from "./http";
import { beginLibraryDrag, endLibraryDrag } from "./libraryDrag";
import { formatDuration, isAudioPath, isVideoPath } from "./media";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import { sendToResolve, toast } from "./toast";
import {
  defaultSheetRefSlots,
  modelCostLabel,
  isFlux2EditModel,
  isMuseEditModel,
  pickSheetResolution,
  qualityChoices,
  sheetAnglesFromIdentity,
  sheetComposeModel,
  sheetR2iRefCap,
  sheetSlotPhrase,
  sheetStatFooter,
  SHEET_FULL_BODY_RULE,
  SHEET_NO_PANEL_TEXT,
  SHEET_NO_TEXT,
  SHEET_REF_PACK,
  SCENE_SLOTS,
  SCENE_SLOT_LABEL,
  SCENE_EXTRA_CAMERA_GUARD,
  sceneSizeChoices,
  sizeChoices,
  SLOT_LABEL,
  ensureScenePhotoreal,
  pickSceneAspect,
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

export default function ResultNode({ data, selected }: NodeProps<ResultFlowNode>) {
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
  const isSceneAngle = (SCENE_SLOTS as readonly string[]).includes(data.slot || "");
  const isHeroT2i = isSceneAngle && data.slot === "hero" && !data.sourceStill;
  const sceneModel = isHeroT2i
    ? models.t2i.find((m) => m.id === (data.t2iModel || data.modelId)) ||
      models.t2i[0]
    : isSceneAngle
      ? models.r2i.find((m) => m.id === (data.modelId || data.r2iModel)) ||
        models.r2i[0]
      : null;
  const angleModel = isSceneAngle
    ? sceneModel
    : selectedModel ||
      models.r2i.find((m) => m.id === data.r2iModel) ||
      models.t2i.find((m) => m.id === data.t2iModel);
  const liveSizes = isSheet
    ? sizeChoices(selectedModel)
    : isSceneAngle
      ? sceneSizeChoices(angleModel)
      : [];
  const liveQuals = isSheet
    ? qualityChoices(selectedModel)
    : isSceneAngle
      ? qualityChoices(angleModel)
      : [];
  const fluxEdit = isFlux2EditModel(isSheet ? selectedModel : angleModel);
  const photorealOn =
    String((data.fields && data.fields.photoreal) || "on").toLowerCase() !== "off" &&
    String((data.fields && data.fields.photoreal) || "on").toLowerCase() !== "0";
  const dropVideoSize = (s: string) =>
    Boolean(s) && !/^(360p|480p|540p|720p|1080p|1440p|2160p)$/i.test(s);
  const sizeChoicesList = (
    fluxEdit
      ? ["auto"]
      : isSceneAngle && liveSizes.length
        ? liveSizes
        : isSheet && liveSizes.length
          ? liveSizes
          : Array.isArray(data.resolutionChoices)
            ? data.resolutionChoices
            : []
  ).filter(dropVideoSize);
  const [anglePrompt, setAnglePrompt] = useState(data.prompt || "");
  const [size, setSize] = useState(
    fluxEdit
      ? "auto"
      : data.aspect ||
        (sizeChoicesList.includes(data.resolution || "") ? data.resolution : "") ||
        (isSceneAngle
          ? pickSceneAspect(sizeChoicesList)
          : isSheet
            ? pickSheetResolution(sizeChoicesList)
            : sizeChoicesList[0]) ||
        "",
  );
  const qualityOpts = (
    fluxEdit
      ? []
      : (isSheet || isSceneAngle) && liveQuals.length
        ? liveQuals
        : Array.isArray(data.qualityChoices)
          ? data.qualityChoices
          : []
  ).filter(Boolean);
  const [quality, setQuality] = useState(
    fluxEdit ? "" : data.quality || qualityOpts[0] || "",
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState("");
  const [enhancingDraft, setEnhancingDraft] = useState(false);
  const [noLabels, setNoLabels] = useState(false);
  const [statFooter, setStatFooter] = useState(true);
  const [sheetFields, setSheetFields] = useState<Record<string, string>>(
    data.fields && typeof data.fields === "object" ? data.fields : {},
  );
  const [confirmed, setConfirmed] = useState(false);
  const [estimate, setEstimate] = useState("");
  const [estimateBusy, setEstimateBusy] = useState(isSheet || isSceneAngle);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [angleChips, setAngleChips] = useState<SheetAngleChip[]>([]);
  const [pickedSlots, setPickedSlots] = useState<string[]>([]);
  const pickedManualRef = useRef(false);
  const cap = isSheet ? sheetR2iRefCap(selectedModel) : Number(data.maxRefs) || 0;
  const isCharacterSheet =
    isSheet &&
    (data.sheetKind === "character" || (!data.sheetKind && data.slot === "sheet"));
  const isSceneSheet = isSheet && data.sheetKind === "scene";
  const isSheetPicker = isCharacterSheet || isSceneSheet;
  const sheetRefPack = isSceneSheet ? SCENE_SLOTS : SHEET_REF_PACK;
  const sheetRefLabel = isSceneSheet ? SCENE_SLOT_LABEL : SLOT_LABEL;
  useEffect(() => {
    pickedManualRef.current = false;
  }, [data.assetId]);
  useEffect(() => {
    setAnglePrompt(data.prompt || "");
  }, [data.prompt]);
  useEffect(() => {
    if (data.fields && typeof data.fields === "object") setSheetFields(data.fields);
  }, [data.fields]);
  useEffect(() => {
    if (!isCharacterSheet || !data.assetId || Object.keys(sheetFields).length) return;
    const ac = new AbortController();
    fetch(`/assets/${data.assetId}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { item?: { fields?: Record<string, string>; name?: string } } | null) => {
        const next = body?.item?.fields;
        if (next && typeof next === "object") setSheetFields(next);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => ac.abort();
  }, [isCharacterSheet, data.assetId]);
  useEffect(() => {
    if (fluxEdit) return;
    if (data.aspect && data.aspect !== size) setSize(data.aspect);
  }, [data.aspect, fluxEdit]);
  useEffect(() => {
    if (fluxEdit) {
      setSize("auto");
      setQuality("");
      return;
    }
    if (isSceneAngle && liveSizes.length) {
      setSize((cur) =>
        liveSizes.includes(cur) ? cur : pickSceneAspect(liveSizes),
      );
      setQuality((cur) =>
        liveQuals.includes(cur) ? cur : liveQuals[0] || "",
      );
      return;
    }
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
  }, [selectedModel?.id, fluxEdit]);
  useEffect(() => {
    if (!data.generating) setBusy(false);
  }, [data.generating]);
  useEffect(() => {
    const costModel = isSheet ? selectedModel : isSceneAngle ? angleModel : null;
    if (!costModel?.id || !(isSheet || isSceneAngle)) {
      setEstimate("");
      setEstimateBusy(false);
      return;
    }
    const ac = new AbortController();
    setEstimateBusy(true);
    setEstimate("");
    const qs = new URLSearchParams({
      mode: "image",
      modality: isSheet || !isHeroT2i ? "r2i" : "t2i",
      model_id: costModel.id,
      num_images: "1",
    });
    const aspect = fluxEdit ? "auto" : size || data.aspect || "";
    const resolution = fluxEdit
      ? "auto"
      : quality || (isSceneAngle ? "" : data.resolution) || "";
    if (aspect) qs.set("aspect", aspect);
    if (resolution) qs.set("resolution", resolution);
    fetch(`/estimate?${qs}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { ok?: boolean; cost?: string } | null) => {
        if (ac.signal.aborted) return;
        if (body?.cost && String(body.cost).includes("$")) {
          setEstimate(body.cost);
        } else {
          setEstimate(modelCostLabel(costModel));
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEstimate(modelCostLabel(costModel));
      })
      .finally(() => {
        if (!ac.signal.aborted) setEstimateBusy(false);
      });
    return () => ac.abort();
  }, [
    isSheet,
    isSceneAngle,
    selectedModel?.id,
    size,
    quality,
    data.aspect,
    data.resolution,
    data.slot,
    data.sourceStill,
    data.t2iModel,
    data.r2iModel,
    data.modelId,
    fluxEdit,
    isHeroT2i,
    angleModel?.id,
  ]);
  useEffect(() => {
    if (!isSheetPicker) {
      setAngleChips([]);
      return;
    }
    const previews = Array.isArray(data.refPreviews) ? data.refPreviews : [];
    const fromPreview: SheetAngleChip[] = previews
      .filter((c) => c.path)
      .map((c) => {
        const id = String(c.id || "").trim();
        const slot =
          sheetRefPack.find((s) => s === id) ||
          (Object.keys(sheetRefLabel).find((s) => sheetRefLabel[s] === c.label) ||
            Object.keys(SLOT_LABEL).find((s) => SLOT_LABEL[s] === c.label) ||
            "");
        return {
          slot: slot || id || (isSceneSheet ? "hero" : "front"),
          label: c.label || sheetRefLabel[slot] || SLOT_LABEL[slot] || slot || "Ref",
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
        slot: sheetRefPack[i] || `ref_${i + 1}`,
        label: sheetRefLabel[sheetRefPack[i] || ""] || `Ref ${i + 1}`,
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
                slot: sheetRefPack[i] || `ref_${i + 1}`,
                label: sheetRefLabel[sheetRefPack[i] || ""] || `Ref ${i + 1}`,
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
  }, [isSheetPicker, isSceneSheet, data.assetId, data.sourceStill, data.extraRefs, data.refPreviews]);
  useEffect(() => {
    if (!isSheetPicker || !angleChips.length) return;
    const avail = angleChips.map((c) => c.slot);
    const def = defaultSheetRefSlots(avail, cap, sheetRefPack);
    setPickedSlots((cur) => {
      if (!pickedManualRef.current) return def;
      return cur.filter((s) => avail.includes(s));
    });
  }, [isSheetPicker, cap, angleChips, isSceneSheet]);

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
    if (isSheetPicker && angleChips.length) {
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
            isSceneSheet
              ? "[Rewrite this location-sheet prompt only.]"
              : "[Rewrite this character-sheet prompt only.]",
            names
              ? isSceneSheet
                ? `Panels to include (name each once, attached stills only, do not invent extras): ${names}.`
                : `Panels to include (name each once, do not repeat a slot): ${names}.`
              : "",
            isSceneSheet
              ? "Match attached stills only. Same space in every panel. Do not invent a medium panel."
              : SHEET_FULL_BODY_RULE,
            isSceneSheet
              ? "Keep location lock. No gibberish labels."
              : "Keep identity and wardrobe lock. No gibberish labels.",
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
      const kept = isSceneSheet && photorealOn ? ensureScenePhotoreal(rewritten, true) : rewritten;
      setAnglePrompt(kept);
      data.onPrompt?.(kept);
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
    const sceneExtra =
      isSceneSheet === false &&
      (SCENE_SLOTS as readonly string[]).includes(slot) &&
      slot !== "hero";
    if (slot !== "front" && slot !== "hero" && !data.sourceStill) {
      setLocalError(
        slot === "sheet"
          ? "Generate at least one angle first"
          : sceneExtra || data.sheetKind === "scene"
            ? "Generate Hero first"
            : "Generate Front first",
      );
      return;
    }
    const extras = Array.isArray(data.extraRefs) ? data.extraRefs.filter(Boolean) : [];
    const packed: string[] = [];
    if (isSheetPicker && angleChips.length) {
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
    const pickedAspect = fluxEdit ? "auto" : size || data.aspect || "";
    const pickedQuality = fluxEdit ? "" : quality || "";
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
            kind:
              data.sheetKind === "scene" ||
              (SCENE_SLOTS as readonly string[]).includes(slot)
                ? "scene"
                : data.sheetKind === "prop"
                  ? "prop"
                  : data.sheetKind === "costume"
                    ? "costume"
                    : "character",
            name:
              data.name ||
              (data.sheetKind === "scene" ||
              (SCENE_SLOTS as readonly string[]).includes(slot)
                ? "Scene"
                : "Character"),
            fields: data.fields || {},
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
            : isHeroT2i || (slot === "front" && !data.sourceStill)
              ? data.t2iModel || ""
              : data.modelId || data.r2iModel || data.t2iModel || "",
          prompt: (() => {
            let send = prompt;
            if ((isSceneAngle || isSceneSheet) && photorealOn) {
              send = ensureScenePhotoreal(send, true);
            }
            if (
              isSceneAngle &&
              slot !== "hero" &&
              !send.toLowerCase().includes(SCENE_EXTRA_CAMERA_GUARD.toLowerCase())
            ) {
              send = `${SCENE_EXTRA_CAMERA_GUARD} ${send}`;
            }
            if (!isSheet) return send;
            const footer =
              isCharacterSheet && statFooter
                ? sheetStatFooter(data.name, sheetFields)
                : "";
            if (noLabels && !footer && !send.includes("No text, no labels")) {
              send = `${send} ${SHEET_NO_TEXT}`;
            } else if (noLabels && footer) {
              send = `${send} ${SHEET_NO_PANEL_TEXT}`;
            }
            if (footer) {
              send = `${send}\n\nFooter caption only (small clean text along the bottom of the sheet, not inside pose panels): ${footer}.`;
            }
            return send;
          })(),
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
      if (
        fluxEdit &&
        /rejected image_size/i.test(failMsg) &&
        /not Auto/i.test(failMsg)
      ) {
        failMsg = "Generate failed.";
      }
      console.error("Angle generate failed", err);
      setLocalError(failMsg);
    } finally {
      setBusy(false);
      data.onBusy?.(false, failMsg);
    }
  }

  const costLine = estimateBusy
    ? "—"
    : estimate ||
      result.cost ||
      (isSheet || isSceneAngle ? modelCostLabel(angleModel) : "");

  return (
    <div className="studio-node result-node">
      <NodeResizer
        minWidth={320}
        minHeight={320}
        isVisible={Boolean(selected)}
        lineClassName="node-resize-line"
        handleClassName="node-resize-handle"
      />
      <Handle type="target" position={Position.Left} className="node-handle" />
      <Handle type="source" position={Position.Right} className="node-handle" />
      <div className="node-header">
        <span>{title}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="meta">
          <span>
            {data.generating ? "Generating…" : costLine || "—"}
          </span>
          {result.duration_sec ? (
            <span>{formatDuration(result.duration_sec)}</span>
          ) : null}
        </p>
        <div className="media" onDoubleClick={enlarge}>
          {paths.map((src) =>
            isVideoPath(src) ? (
              <video
                key={src}
                src={src}
                controls
                playsInline
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openLightbox({ src, kind: "video", title });
                }}
              />
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
              <img
                src={src}
                alt="Generated result"
                draggable={false}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openLightbox({ src, kind: "image", title });
                }}
              />
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
            {isSheetPicker && angleChips.length ? (
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
                <span className="field-label">{fluxEdit ? "Size" : "Aspect / size"}</span>
                <select
                  className="model"
                  value={sizeChoicesList.includes(size) ? size : sizeChoicesList[0]}
                  disabled={data.generating || busy || fluxEdit}
                  onChange={(e) => {
                    setSize(e.target.value);
                    data.onResolution?.(e.target.value);
                  }}
                >
                  {sizeChoicesList.map((s) => (
                    <option key={s.toLowerCase()} value={s}>
                      {s.toLowerCase() === "auto" ? "Auto" : s}
                    </option>
                  ))}
                </select>
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
                  onChange={(e) => {
                    setQuality(e.target.value);
                    data.onQuality?.(e.target.value);
                  }}
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
            {isCharacterSheet ? (
              <label className="param">
                <span>
                  <input
                    type="checkbox"
                    checked={statFooter}
                    disabled={data.generating || busy}
                    onChange={(e) => setStatFooter(e.target.checked)}
                  />{" "}
                  Stat footer
                  {statFooter && sheetStatFooter(data.name, sheetFields) ? (
                    <span className="hint">
                      {" "}
                      {sheetStatFooter(data.name, sheetFields)}
                    </span>
                  ) : null}
                </span>
              </label>
            ) : null}
            <p className="estimate">
              {isSheet
                ? `${estimateBusy ? "—" : estimate || modelCostLabel(selectedModel)} · ${packedRefCount()} / ${cap || "—"} refs`
                : estimateBusy
                  ? "—"
                  : estimate || result.cost || modelCostLabel(angleModel)}
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
              {isSheetPicker ? (
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
                  (isSheetPicker && cap > 0 && packedRefCount() > cap)
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
