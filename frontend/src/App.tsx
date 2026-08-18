import { useEffect, useMemo, useState } from "react";
import "./App.css";

type Mode = "image" | "video" | "audio";

type ModelRow = {
  id: string;
  label: string;
  mode?: string;
  modality?: string;
  notes?: string;
  endpoint?: string;
  cost_estimate_usd?: number;
  cost?: string;
};

type GenerateResponse = {
  ok: boolean;
  result_paths?: string[];
  cost?: string;
  duration_sec?: number;
  error?: string | null;
  status?: string;
  job_kind?: string;
};

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

function extOf(path: string): string {
  const clean = path.split("?")[0].toLowerCase();
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot) : "";
}

function isVideoPath(path: string): boolean {
  return [".mp4", ".webm", ".mov", ".m4v"].includes(extOf(path));
}

function isAudioPath(path: string): boolean {
  return [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac", ".opus"].includes(
    extOf(path),
  );
}

function formatDuration(sec: number | undefined): string {
  if (sec == null || Number.isNaN(sec)) return "—";
  if (sec < 10) return `${sec.toFixed(1)}s`;
  return `${Math.round(sec)}s`;
}

export default function App() {
  const [mode, setMode] = useState<Mode>("image");
  const [modality, setModality] = useState("t2i");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [estimate, setEstimate] = useState("Est. cost: —");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const modalityOptions = MODALITIES[mode];
  const selectedModel = useMemo(
    () => models.find((m) => m.id === modelId) ?? null,
    [models, modelId],
  );

  const canGenerate =
    prompt.trim().length > 0 && Boolean(modelId) && !loading;

  useEffect(() => {
    const first = MODALITIES[mode][0]?.id ?? "";
    setModality(first);
    setResult(null);
    setError(null);
  }, [mode]);

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
      .then((data: { models?: ModelRow[]; default_id?: string }) => {
        const rows = data.models ?? [];
        setModels(rows);
        const next =
          (data.default_id && rows.some((r) => r.id === data.default_id)
            ? data.default_id
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
    if (!modelId) {
      setEstimate("Est. cost: —");
      return;
    }
    const ac = new AbortController();
    const qs = new URLSearchParams({ mode, modality, model_id: modelId });
    fetch(`/estimate?${qs}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Estimate ${res.status}`);
        return res.json();
      })
      .then((data: { cost?: string }) => {
        setEstimate(data.cost || "Est. cost: —");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEstimate("Est. cost: —");
      });
    return () => ac.abort();
  }, [mode, modality, modelId]);

  async function onGenerate() {
    if (!canGenerate) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          modality,
          model_id: modelId,
          prompt: prompt.trim(),
          surface: "studio",
          params: {},
        }),
      });
      const data = (await res.json()) as GenerateResponse & { detail?: string };
      if (!res.ok) {
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : data.error || `Generate failed (${res.status})`;
        setError(detail);
        return;
      }
      setResult(data);
      if (!data.ok) {
        setError(data.error || data.status || "Generate failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generate request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>AI Media Studio V2</h1>
        <p className="lede">Prompt → Generate → Result</p>
      </header>

      <section className="panel">
        <div className="pills" role="tablist" aria-label="Mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "pill on" : "pill"}
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
              className={modality === item.id ? "pill on" : "pill"}
              onClick={() => {
                setModality(item.id);
                setResult(null);
                setError(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="prompt-label" htmlFor="model">
          Model
        </label>
        <select
          id="model"
          className="model"
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

        <label className="prompt-label" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="prompt"
          rows={8}
          placeholder="Describe the still, clip, or track…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <p className="estimate">{estimate}</p>
        {mode === "audio" ? (
          <p className="hint">Audio generate is Phase 7 — models list only.</p>
        ) : null}

        <button
          type="button"
          className="generate"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </section>

      {error ? (
        <section className="panel result error" role="alert">
          <h2>Error</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {result?.ok ? (
        <section className="panel result">
          <h2>Result</h2>
          <p className="meta">
            <span>{result.cost || "Cost: —"}</span>
            <span>{formatDuration(result.duration_sec)}</span>
          </p>
          <div className="media">
            {(result.result_paths ?? []).map((src) =>
              isVideoPath(src) ? (
                <video key={src} src={src} controls playsInline />
              ) : isAudioPath(src) ? (
                <audio key={src} src={src} controls />
              ) : (
                <img key={src} src={src} alt="Generated result" />
              ),
            )}
            {(result.result_paths ?? []).length === 0 ? (
              <p className="hint">No media paths returned.</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
