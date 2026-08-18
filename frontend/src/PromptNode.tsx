import { useEffect, useMemo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  durationOptions,
  formatDurationToken,
  inputPlan,
  maxRefImages,
  resolutionOptions,
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
  audio: [
    { id: "music", label: "Music" },
    { id: "sfx", label: "SFX" },
    { id: "ambience", label: "Ambience" },
    { id: "video_sfx", label: "Video SFX" },
    { id: "voiceover", label: "Voiceover" },
    { id: "voice_clone", label: "Clone" },
  ],
};

export type PromptFlowNode = Node<PromptNodeData, "prompt">;

export default function PromptNode({ data }: NodeProps<PromptFlowNode>) {
  const [mode, setMode] = useState<Mode>("image");
  const [modality, setModality] = useState("t2i");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("");
  const [aspect, setAspect] = useState("");
  const [resolution, setResolution] = useState("");
  const [audioOn, setAudioOn] = useState<boolean | null>(null);
  const [estimate, setEstimate] = useState("Est. cost: —");
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalityOptions = MODALITIES[mode];
  const selectedModel = useMemo(
    () => models.find((m) => m.id === modelId) ?? null,
    [models, modelId],
  );
  const plan = inputPlan(modality, selectedModel);
  const durs = durationOptions(selectedModel);
  const aspects = selectedModel?.aspect_choices ?? [];
  const resolutions = resolutionOptions(selectedModel);
  const showAudio = Boolean(selectedModel?.supports_audio);
  const promptRequired = modality !== "i2v";
  const maxRefs = data.maxRefs || maxRefImages(selectedModel, modality);
  const characters = data.characters ?? [];
  const scenes = data.scenes ?? [];
  const filledRefs = countFilledRefs(data.source, characters, scenes);

  const missing: string[] = [];
  if (plan.first && !data.first?.path) missing.push("First Frame");
  if (plan.last && !data.last?.path) missing.push("Last Frame");
  if (plan.source && !plan.sourceOptional && !data.source?.path) {
    missing.push(plan.source === "video" ? "Source video" : "Source still");
  } else if (plan.source === "video" && data.source && data.source.kind !== "video") {
    missing.push("Source video (clip, not a still)");
  } else if (
    plan.source === "image" &&
    data.source &&
    data.source.kind === "video"
  ) {
    missing.push("Source still (not a clip)");
  }
  if (plan.sourceOptional && filledRefs === 0) {
    missing.push("Character, Scene, or Source");
  }
  if (maxRefs > 0 && filledRefs > maxRefs) {
    missing.push(`Too many refs (${filledRefs} / ${maxRefs})`);
  }

  const canGenerate =
    Boolean(modelId) &&
    !loading &&
    !enhancing &&
    missing.length === 0 &&
    (!promptRequired || prompt.trim().length > 0);
  const canEnhance = Boolean(prompt.trim()) && !enhancing && !loading;

  useEffect(() => {
    setModality(MODALITIES[mode][0]?.id ?? "");
    setError(null);
  }, [mode]);

  const onModalityChange = data.onModalityChange;
  useEffect(() => {
    onModalityChange(mode, modality, selectedModel);
  }, [mode, modality, selectedModel, onModalityChange]);

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
        const rows = body.models ?? [];
        setModels(rows);
        const next =
          (body.default_id && rows.some((r) => r.id === body.default_id)
            ? body.default_id
            : rows[0]?.id) || "";
        setModelId(next);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
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
  }, [mode, modality, modelId, duration, aspect, resolution, audioOn]);

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
      );
      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          modality,
          model_id: modelId,
          prompt: composePrompt(prompt.trim(), characters, scenes),
          surface: "studio",
          params: {
            duration: duration || null,
            aspect: aspect || null,
            resolution: resolution || null,
            audio_on: audioOn,
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
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        prompt?: string;
        error?: string;
        detail?: string;
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enhance failed.");
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className="studio-node prompt-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">Prompt</div>
      <div className="node-body nodrag">
        <div className="pills" role="tablist" aria-label="Mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "pill mode on" : "pill mode"}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

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

        {durs.length > 0 || aspects.length > 0 || resolutions.length > 0 || showAudio ? (
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
          </div>
        ) : null}

        <label className="field-label" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="prompt nodrag nowheel"
          rows={5}
          placeholder="Describe the still, clip, or track…"
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
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
        <p className="estimate">{estimate}</p>

        {plan.characters || plan.scenes ? (
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
        ) : plan.source ? (
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

        {plan.first || plan.last ? (
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

        {mode === "audio" ? (
          <p className="hint">Audio generate is Phase 7 — models list only.</p>
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
) {
  const slots: {
    start_still?: string;
    end_still?: string;
    source_video?: string;
    ref_images: string[];
    character_ids: string[];
    scene_ids: string[];
    ref_roles: RefRolePayload[];
  } = {
    ref_images: [],
    character_ids: [],
    scene_ids: [],
    ref_roles: enhanceRefs(source, characters, scenes),
  };
  if (first?.path) slots.start_still = first.path;
  if (last?.path) slots.end_still = last.path;
  if (source?.path) {
    if (modality === "v2v" || modality === "extend" || source.kind === "video") {
      slots.source_video = source.path;
    } else if (!slots.start_still) {
      slots.start_still = source.path;
    }
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
