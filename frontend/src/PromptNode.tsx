import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import FrameEdit, {
  ALEPH_MAX_PINS,
  ALEPH_MIN_S,
} from "./FrameEdit";
import NodeClose from "./NodeClose";
import PromptErrorBoundary from "./PromptErrorBoundary";
import { itemMediaKind } from "./libraryDrag";
import { toast } from "./toast";
import {
  durationOptions,
  formatDurationToken,
  inputPlan,
  maxRefImages,
  resolutionOptions,
  type FramePin,
  type GenerateResponse,
  type LibraryItem,
  type Mode,
  type ModelRow,
  type PromptNodeData,
  type RefRolePayload,
  type RefSlotState,
} from "./types";

const MODES: { id: Mode; label: string }[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "frame", label: "Frame" },
  { id: "audio", label: "Audio" },
];

const MODALITIES: Record<Mode, { id: string; label: string }[]> = {
  image: [
    { id: "t2i", label: "T2I" },
    { id: "i2i", label: "I2I" },
    { id: "r2i", label: "R2I" },
    { id: "region", label: "Region" },
  ],
  video: [
    { id: "t2v", label: "T2V" },
    { id: "i2v", label: "I2V" },
    { id: "r2v", label: "R2V" },
    { id: "v2v", label: "V2V" },
    { id: "bridge", label: "Bridge" },
    { id: "extend", label: "Extend" },
  ],
  frame: [{ id: "frame", label: "Edit" }],
  audio: [
    { id: "music", label: "Music" },
    { id: "sfx", label: "SFX" },
    { id: "voice", label: "Voice" },
  ],
};

export type PromptFlowNode = Node<PromptNodeData, "prompt">;

const FRAME_FALLBACK_MODEL: ModelRow = {
  id: "runware:aleph@2.0",
  label: "Aleph 2.0 (Runware)",
  mode: "frame",
  modality: "frame",
  notes: "Configure Runware / model unavailable — paste a Runware key in Settings.",
  requires_runware: true,
};

function modesFor(mode: Mode) {
  return MODALITIES[mode] ?? [];
}

export default function PromptNode(props: NodeProps<PromptFlowNode>) {
  const [epoch, setEpoch] = useState(0);
  return (
    <PromptErrorBoundary
      key={epoch}
      onBackToImage={() => setEpoch((n) => n + 1)}
    >
      <PromptNodeInner {...props} />
    </PromptErrorBoundary>
  );
}

function pickPreferredModel(
  rows: ModelRow[],
  hint: string | undefined,
  defaultId: string | undefined,
): string {
  if (hint) {
    const h = hint.toLowerCase();
    const byLabel = rows.find((r) => {
      const blob = `${r.id} ${r.label}`.toLowerCase();
      return blob.includes(h) && !blob.includes("t2i");
    });
    if (byLabel) return byLabel.id;
  }
  if (defaultId && rows.some((r) => r.id === defaultId)) return defaultId;
  return rows[0]?.id || "";
}

function PromptNodeInner({ data }: NodeProps<PromptFlowNode>) {
  const lock = data.lockTo;
  const [mode, setMode] = useState<Mode>(lock?.mode ?? "image");
  const [modality, setModality] = useState(lock?.modality ?? "t2i");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("");
  const [aspect, setAspect] = useState("");
  const [resolution, setResolution] = useState("");
  const [audioOn, setAudioOn] = useState<boolean | null>(null);
  const [voice, setVoice] = useState("");
  const [instrumental, setInstrumental] = useState(true);
  const [estimate, setEstimate] = useState("Est. cost: —");
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "generating">("idle");
  const [localPins, setLocalPins] = useState<FramePin[]>([]);
  const pins = data.pins ?? localPins;
  const setPins = data.onPinsChange ?? setLocalPins;
  const [clipDuration, setClipDuration] = useState(0);
  const [hasRunwareKey, setHasRunwareKey] = useState(true);
  const isLocked = Boolean(lock);

  const modalityOptions = modesFor(mode);
  const selectedModel = useMemo(
    () => models.find((m) => m.id === modelId) ?? null,
    [models, modelId],
  );
  const plan = inputPlan(modality, selectedModel, mode);
  const durs = durationOptions(selectedModel);
  const aspects = selectedModel?.aspect_choices ?? [];
  const resolutions = resolutionOptions(selectedModel);
  const showAudio = Boolean(selectedModel?.supports_audio);
  const voices = selectedModel?.voices ?? [];
  const promptRequired = modality !== "i2v";
  const isAudio = mode === "audio";
  const isFrame = mode === "frame";
  const maxRefs = data.maxRefs || maxRefImages(selectedModel, modality);
  const characters = data.characters ?? [];
  const scenes = data.scenes ?? [];
  const filledRefs = countFilledRefs(data.source, characters, scenes);
  const onDuration = useCallback((s: number) => setClipDuration(s), []);

  const missing: string[] = [];
  if (plan.first && !data.first?.path) missing.push("First Frame");
  if (plan.last && !data.last?.path) missing.push("Last Frame");
  if (plan.source && !plan.sourceOptional && !data.source?.path) {
    missing.push(plan.source === "video" ? "Source video" : "Source still");
  } else if (
    plan.source === "video" &&
    data.source &&
    itemMediaKind(data.source) !== "video"
  ) {
    missing.push("Source video (clip, not a still)");
  } else if (
    plan.source === "image" &&
    data.source &&
    itemMediaKind(data.source) === "video"
  ) {
    missing.push("Source still (not a clip)");
  }
  if (plan.sourceOptional && filledRefs === 0) {
    missing.push("Character, Scene, or Source");
  }
  if (maxRefs > 0 && filledRefs > maxRefs) {
    missing.push(`Too many refs (${filledRefs} / ${maxRefs})`);
  }
  if (isFrame && pins.length === 0) missing.push("Pinned frame");
  if (isFrame && pins.length > ALEPH_MAX_PINS) {
    missing.push(`Too many pins (${pins.length} / ${ALEPH_MAX_PINS})`);
  }
  if (isFrame && clipDuration > 0 && clipDuration + 0.05 < ALEPH_MIN_S) {
    missing.push(`Source must be at least ${ALEPH_MIN_S}s`);
  }

  const canGenerate =
    Boolean(modelId) &&
    !loading &&
    !enhancing &&
    missing.length === 0 &&
    (!promptRequired || prompt.trim().length > 0) &&
    (!isFrame || hasRunwareKey);
  const canEnhance = Boolean(prompt.trim()) && !enhancing && !loading && phase === "idle";

  useEffect(() => {
    if (isLocked) return;
    setModality(modesFor(mode)[0]?.id ?? "");
    setError(null);
    setPins([]);
    setClipDuration(0);
  }, [mode, isLocked, setPins]);

  const addSourceRef = useRef(data.onAddSource);
  addSourceRef.current = data.onAddSource;
  useEffect(() => {
    if (isLocked || mode !== "frame") return;
    const id = window.setTimeout(() => {
      try {
        addSourceRef.current?.();
      } catch (err) {
        console.error("Frame add Source failed", err);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [mode, isLocked]);

  useEffect(() => {
    setPins([]);
    setClipDuration(0);
  }, [data.source?.path]);

  useEffect(() => {
    if (!isFrame) return;
    const ac = new AbortController();
    const load = () => {
      fetch("/health", { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { keys?: { runware?: boolean } } | null) => {
          if (body) setHasRunwareKey(Boolean(body.keys?.runware));
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, [isFrame]);

  const onModalityChange = data.onModalityChange;
  useEffect(() => {
    if (isLocked) return;
    try {
      onModalityChange?.(mode, modality, selectedModel);
    } catch (err) {
      console.error("onModalityChange failed", err);
    }
  }, [mode, modality, selectedModel, onModalityChange, isLocked]);

  useEffect(() => {
    const ac = new AbortController();
    setModelsError(null);
    setModels([]);
    setModelId("");
    const qs = new URLSearchParams({ mode, modality });
    fetch(`/models?${qs}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Models ${res.status}`);
        return res.json();
      })
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = Array.isArray(body.models) ? body.models : [];
        if (mode === "frame" && rows.length === 0) {
          setModels([FRAME_FALLBACK_MODEL]);
          setModelId(FRAME_FALLBACK_MODEL.id);
          setModelsError("Configure Runware / model unavailable");
          return;
        }
        setModels(rows);
        setModelId(
          pickPreferredModel(rows, lock?.preferModel, body.default_id),
        );
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Models fetch failed", err);
        if (mode === "frame") {
          setModels([FRAME_FALLBACK_MODEL]);
          setModelId(FRAME_FALLBACK_MODEL.id);
          setModelsError("Configure Runware / model unavailable");
          return;
        }
        setModelsError(
          err instanceof Error ? err.message : "Could not load models.",
        );
      });
    return () => ac.abort();
  }, [mode, modality]);

  useEffect(() => {
    if (!selectedModel) {
      setDuration("");
      setAspect("");
      setResolution("");
      setAudioOn(null);
      return;
    }
    const opts = durationOptions(selectedModel);
    const def = selectedModel.default_duration || opts[0] || "";
    setDuration(def);
    const as = selectedModel.aspect_choices ?? [];
    setAspect(selectedModel.default_aspect || as[0] || "");
    const resOpts = resolutionOptions(selectedModel);
    const resDef = selectedModel.default_resolution || "";
    setResolution(
      resDef && resOpts.includes(resDef) ? resDef : resOpts[0] || "",
    );
    setAudioOn(selectedModel.supports_audio ? true : null);
    setVoice(selectedModel.default_voice || selectedModel.voices?.[0] || "");
    setInstrumental(true);
  }, [selectedModel]);

  useEffect(() => {
    if (!modelId) {
      setEstimate("Est. cost: —");
      return;
    }
    const ac = new AbortController();
    const qs = new URLSearchParams({ mode, modality, model_id: modelId });
    if (duration) qs.set("duration", duration);
    if (aspect) qs.set("aspect", aspect);
    if (resolution) qs.set("resolution", resolution);
    if (audioOn != null) qs.set("generate_audio", audioOn ? "true" : "false");
    if (mode === "audio" && prompt.trim()) qs.set("prompt", prompt.trim());
    if (isFrame && clipDuration > 0) qs.set("duration", String(clipDuration));
    fetch(`/estimate?${qs}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Estimate ${res.status}`);
        return res.json();
      })
      .then((body: { cost?: string }) => {
        setEstimate(body.cost || "Est. cost: —");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEstimate("Est. cost: —");
      });
    return () => ac.abort();
  }, [mode, modality, modelId, duration, aspect, resolution, audioOn, prompt, isFrame, clipDuration]);

  async function onGenerate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    try {
      const slots = slotsFromGraph(
        modality,
        data.source,
        data.first,
        data.last,
        characters,
        scenes,
        isFrame ? pins : undefined,
      );
      if (isFrame && slots.source_video) {
        setPhase("preparing");
        const prepRes = await fetch("/prepare-aleph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_path: slots.source_video }),
        });
        const prep = (await prepRes.json()) as {
          ok?: boolean;
          path?: string;
          error?: string;
          detail?: string;
          status?: string;
        };
        if (!prepRes.ok || !prep.ok || !prep.path) {
          setError(
            prep.error ||
              prep.status ||
              (typeof prep.detail === "string" ? prep.detail : null) ||
              "Could not prepare this clip for Aleph.",
          );
          return;
        }
        slots.source_video = prep.path;
      }
      setPhase("generating");
      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          modality: isFrame ? "frame" : modality,
          model_id: modelId,
          prompt: composePrompt(prompt.trim(), characters, scenes),
          surface: "studio",
          params: {
            duration: isFrame && clipDuration > 0 ? String(clipDuration) : duration || null,
            aspect: aspect || null,
            resolution: resolution || null,
            audio_on: audioOn,
            extra: isAudio
              ? { voice: voice || null, instrumental }
              : {},
          },
          slots,
        }),
      });
      const body = (await res.json()) as GenerateResponse & { detail?: string };
      if (!res.ok) {
        setError(
          typeof body.detail === "string"
            ? body.detail
            : body.error || `Generate failed (${res.status})`,
        );
        return;
      }
      if (!body.ok) {
        setError(body.error || body.status || "Generate failed.");
        return;
      }
      data.onGenerated(body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generate request failed.");
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  }

  async function onEnhance() {
    if (!canEnhance) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model_id: modelId,
          modality,
          mode,
          refs: enhanceRefs(data.source, characters, scenes),
          image_urls: enhanceImagePaths(data),
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        prompt?: string;
        error?: string;
        detail?: string;
        vision?: boolean;
      };
      if (!res.ok || !body.ok) {
        setError(
          body.error ||
            (typeof body.detail === "string" ? body.detail : null) ||
            "Enhance failed.",
        );
        return;
      }
      if (body.prompt) setPrompt(body.prompt);
      const sent = enhanceImagePaths(data);
      if (sent.length && body.vision === false) {
        toast("Enhance ran without image context", true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enhance failed.");
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className={isFrame ? "studio-node prompt-node frame-wide" : "studio-node prompt-node"}>
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>{lock?.title || "Prompt"}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        {!isLocked ? (
        <div className="pills" role="tablist" aria-label="Mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "pill mode on" : "pill mode"}
              onClick={() => {
                const next = item.id;
                setMode(next);
                try {
                  data.onModalityChange?.(
                    next,
                    modesFor(next)[0]?.id ?? "",
                    null,
                  );
                } catch (err) {
                  console.error("Mode change failed", err);
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        ) : (
          <p className="hint pin-edit-banner">{lock?.title || "Image · I2I"}</p>
        )}

        {!isLocked && !isFrame ? (
        <div className="pills chips" role="tablist" aria-label="Modality">
          {modalityOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={modality === item.id}
              className={
                modality === item.id ? "pill modality on" : "pill modality"
              }
              onClick={() => {
                setModality(item.id);
                setError(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        ) : null}

        <label className="field-label" htmlFor="model">
          Model
        </label>
        <select
          id="model"
          className="model nodrag"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={models.length === 0}
        >
          {models.length === 0 ? (
            <option value="">
              {modelsError ? "No models (API offline?)" : "Loading models…"}
            </option>
          ) : (
            models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))
          )}
        </select>
        {modelsError ? <p className="hint warn">{modelsError}</p> : null}
        {selectedModel?.notes ? (
          <p className="hint">{selectedModel.notes}</p>
        ) : null}

        {isFrame && typeof FrameEdit !== "function" ? (
          <p className="hint warn" role="alert">
            Frame layout failed to load. Refresh the page or click Image.
          </p>
        ) : isFrame ? (
          <PromptErrorBoundary
            onBackToImage={() => {
              setMode("image");
              try {
                data.onModalityChange?.("image", "t2i", null);
              } catch (err) {
                console.error("Back to Image failed", err);
              }
            }}
          >
            <FrameEdit
              source={data.source ?? null}
              pins={Array.isArray(pins) ? pins : []}
              onPinsChange={setPins}
              onDuration={onDuration}
              hasRunwareKey={hasRunwareKey}
              onOpenSettings={data.onOpenSettings}
              onAddSource={() => {
                try {
                  data.onAddSource?.();
                } catch (err) {
                  console.error("Frame add Source failed", err);
                }
              }}
              onAttachSource={(item) => {
                try {
                  data.onAddSource?.();
                  data.onAttachSource?.(item);
                } catch (err) {
                  console.error("Frame attach Source failed", err);
                }
              }}
              onEditPin={data.onEditPin}
              onCommitPinStill={data.onCommitPinStill}
              editingPinId={data.editingPinId}
              preparing={phase === "preparing"}
            />
          </PromptErrorBoundary>
        ) : null}

        {!isFrame && (durs.length > 0 || aspects.length > 0 || resolutions.length > 0 || showAudio || voices.length > 0 || isAudio && modality === "music") ? (
          <div className="params">
            {durs.length > 0 ? (
              <label className="param">
                <span>Duration</span>
                <select
                  className="model nodrag"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  {durs.map((tok) => (
                    <option key={tok} value={tok}>
                      {formatDurationToken(tok)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {aspects.length > 0 ? (
              <label className="param">
                <span>Aspect</span>
                <select
                  className="model nodrag"
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                >
                  {aspects.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {resolutions.length > 0 ? (
              <label className="param">
                <span>Resolution</span>
                <select
                  className="model nodrag"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                >
                  {resolutions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showAudio ? (
              <label className="param check">
                <input
                  type="checkbox"
                  checked={Boolean(audioOn)}
                  onChange={(e) => setAudioOn(e.target.checked)}
                />
                Audio
              </label>
            ) : null}
            {voices.length > 0 ? (
              <label className="param">
                <span>Voice</span>
                <select
                  className="model nodrag"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                >
                  {voices.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {isAudio && modality === "music" ? (
              <label className="param check">
                <input
                  type="checkbox"
                  checked={instrumental}
                  onChange={(e) => setInstrumental(e.target.checked)}
                />
                Instrumental
              </label>
            ) : null}
          </div>
        ) : null}

        <label className="field-label" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="prompt nodrag nowheel"
          rows={5}
          placeholder={
            isFrame
              ? "What to change on the pinned frames…"
              : isAudio && modality === "voice"
              ? "Script to speak…"
              : isAudio && modality === "sfx"
                ? "Describe the sound…"
                : isAudio
                  ? "Style, mood, instruments…"
                  : "Describe the still, clip, or track…"
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="prompt-actions">
          <button
            type="button"
            className="ghost nodrag enhance"
            disabled={!canEnhance}
            onClick={onEnhance}
          >
            {enhancing ? "Enhancing…" : "Enhance"}
          </button>
          <button
            type="button"
            className="generate nodrag"
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            {phase === "preparing"
              ? "Preparing clip for Aleph…"
              : loading
                ? "Generating…"
                : "Generate"}
          </button>
        </div>
        <p className="estimate">{estimate}</p>

        {!isFrame && (plan.characters || plan.scenes) ? (
          <div className="source-row">
            {plan.characters ? (
              <button
                type="button"
                className="ghost nodrag"
                disabled={maxRefs > 0 && reservedRefNodes(data.source, characters, scenes) >= maxRefs}
                onClick={data.onAddCharacter}
              >
                Add Character
              </button>
            ) : null}
            {plan.scenes ? (
              <button
                type="button"
                className="ghost nodrag"
                disabled={maxRefs > 0 && reservedRefNodes(data.source, characters, scenes) >= maxRefs}
                onClick={data.onAddScene}
              >
                Add Scene
              </button>
            ) : null}
            {plan.source ? (
              <button type="button" className="ghost nodrag" onClick={data.onAddSource}>
                {data.source ? "Source attached" : "Add Source"}
              </button>
            ) : null}
            {maxRefs > 0 ? (
              <span className={filledRefs > maxRefs ? "hint warn" : "hint"}>
                {filledRefs} / {maxRefs} refs
              </span>
            ) : null}
            {missing.includes("Character, Scene, or Source") ? (
              <span className="hint warn">
                Needs a Character, Scene, or Source
              </span>
            ) : null}
          </div>
        ) : !isLocked && !isFrame && plan.source ? (
          <div className="source-row">
            <button type="button" className="ghost nodrag" onClick={data.onAddSource}>
              {data.source ? "Source attached" : "Add Source"}
            </button>
            {data.source ? (
              <span className="hint" title={data.source.path}>
                {data.source.name}
              </span>
            ) : (
              <span className="hint warn">
                {plan.source === "video"
                  ? "Needs a Source clip"
                  : "Needs a Source still"}
              </span>
            )}
          </div>
        ) : null}

        {!isFrame && (plan.first || plan.last) ? (
          <div className="source-row">
            {plan.first ? (
              <button type="button" className="ghost nodrag" onClick={data.onAddFirst}>
                {data.first ? "First Frame attached" : "Add First Frame"}
              </button>
            ) : null}
            {plan.last ? (
              <button type="button" className="ghost nodrag" onClick={data.onAddLast}>
                {data.last ? "Last Frame attached" : "Add Last Frame"}
              </button>
            ) : null}
            {missing.length ? (
              <span className="hint warn">Needs {missing.join(" + ")}</span>
            ) : null}
          </div>
        ) : null}

        {modality === "bridge" && data.source ? (
          <p className="hint">
            Bridge uses First/Last — you can close Source
          </p>
        ) : null}

        {error ? (
          <p className="hint warn" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

function pathKey(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

export function countFilledRefs(
  source: LibraryItem | null,
  characters: RefSlotState[],
  scenes: RefSlotState[],
): number {
  const seen = new Set<string>();
  const add = (path?: string | null) => {
    const p = (path || "").trim();
    if (!p) return;
    const key = pathKey(p);
    if (seen.has(key)) return;
    seen.add(key);
  };
  add(source?.path);
  for (const row of characters) add(row.item?.path);
  for (const row of scenes) add(row.item?.path);
  return seen.size;
}

export function reservedRefNodes(
  source: LibraryItem | null,
  characters: RefSlotState[],
  scenes: RefSlotState[],
): number {
  return characters.length + scenes.length + (source?.path ? 1 : 0);
}

function composePrompt(
  base: string,
  characters: RefSlotState[],
  scenes: RefSlotState[],
): string {
  const lines: string[] = [];
  for (const row of characters) {
    if (!row.item?.path) continue;
    const name = row.item.name || "character";
    const note = row.note.trim();
    lines.push(
      note ? `Character (${name}): ${note}` : `Character reference: ${name}`,
    );
  }
  for (const row of scenes) {
    if (!row.item?.path) continue;
    const name = row.item.name || "scene";
    const note = row.note.trim();
    lines.push(note ? `Scene (${name}): ${note}` : `Scene reference: ${name}`);
  }
  if (!lines.length) return base;
  return `${lines.join("\n")}\n\n${base}`.trim();
}

function enhanceImagePaths(data: PromptNodeData): string[] {
  const out: string[] = [];
  const add = (path?: string | null) => {
    const p = (path || "").trim();
    if (!p || out.includes(p)) return;
    out.push(p);
  };
  if (itemMediaKind(data.source) === "image") add(data.source?.path);
  for (const pin of data.pins || []) add(pin.image?.path);
  return out.slice(0, 3);
}

function enhanceRefs(
  source: LibraryItem | null,
  characters: RefSlotState[],
  scenes: RefSlotState[],
): RefRolePayload[] {
  const out: RefRolePayload[] = [];
  if (source?.path) {
    out.push({ path: source.path, role: "source", name: source.name });
  }
  for (const row of characters) {
    if (!row.item?.path) continue;
    out.push({
      path: row.item.path,
      role: "character",
      id: row.catalogId || null,
      name: row.item.name,
      note: row.note.trim() || null,
    });
  }
  for (const row of scenes) {
    if (!row.item?.path) continue;
    out.push({
      path: row.item.path,
      role: "scene",
      id: row.catalogId || null,
      name: row.item.name,
      note: row.note.trim() || null,
    });
  }
  return out;
}

function slotsFromGraph(
  modality: string,
  source: LibraryItem | null,
  first: LibraryItem | null,
  last: LibraryItem | null,
  characters: RefSlotState[],
  scenes: RefSlotState[],
  pins?: FramePin[],
) {
  const slots: {
    start_still?: string;
    end_still?: string;
    source_video?: string;
    ref_images: string[];
    character_ids: string[];
    scene_ids: string[];
    ref_roles: RefRolePayload[];
    keyframes?: {
      image_path: string;
      pin: string;
      timestamp_s: number;
    }[];
  } = {
    ref_images: [],
    character_ids: [],
    scene_ids: [],
    ref_roles: enhanceRefs(source, characters, scenes),
  };
  if (first?.path) slots.start_still = first.path;
  if (last?.path) slots.end_still = last.path;
  if (source?.path) {
    if (
      modality === "v2v" ||
      modality === "extend" ||
      modality === "frame" ||
      source.kind === "video"
    ) {
      slots.source_video = source.path;
    } else if (!slots.start_still) {
      slots.start_still = source.path;
    }
  }
  if (pins?.length) {
    slots.keyframes = pins
      .filter((p) => p.image.path)
      .map((p) => ({
        image_path: p.image.path,
        pin: p.pin,
        timestamp_s: p.timestamp_s,
      }));
  }
  const seen = new Set<string>();
  for (const row of [...characters, ...scenes]) {
    const path = row.item?.path;
    if (!path) continue;
    const key = pathKey(path);
    if (seen.has(key)) continue;
    seen.add(key);
    slots.ref_images.push(path);
  }
  for (const row of characters) {
    if (row.catalogId) slots.character_ids.push(row.catalogId);
  }
  for (const row of scenes) {
    if (row.catalogId) slots.scene_ids.push(row.catalogId);
  }
  return slots;
}
