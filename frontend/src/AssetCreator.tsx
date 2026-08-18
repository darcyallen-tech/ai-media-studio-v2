import { useEffect, useRef, useState } from "react";
import { toast } from "./toast";
import type { AssetRole, ModelRow, StudioAsset } from "./types";

type Props = {
  kind: AssetRole;
  onClose: () => void;
  onSaved: (asset: StudioAsset) => void;
};

const KIND_LABEL: Record<AssetRole, string> = {
  character: "Character",
  scene: "Scene",
  prop: "Prop",
};

function maxStills(kind: AssetRole) {
  return kind === "character" ? 3 : 1;
}

function sheetModel(row: ModelRow) {
  const blob = `${row.id} ${row.label}`.toLowerCase();
  return blob.includes("flux") || blob.includes("seedream") || blob.includes("nano");
}

export default function AssetCreator({ kind, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState<"save" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canGenerate = kind === "character" || kind === "scene";
  const cap = maxStills(kind);

  useEffect(() => {
    if (!canGenerate) return;
    const ac = new AbortController();
    fetch("/models?mode=image&modality=t2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = (body.models ?? []).filter(sheetModel);
        setModels(rows);
        setModelId((cur) => cur || body.default_id || rows[0]?.id || "");
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [canGenerate]);

  function pickFiles(list: FileList | File[]) {
    const next = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((cur) => [...cur, ...next].slice(0, cap));
  }

  async function onSave() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("name", label);
      fd.append("notes", notes.trim());
      for (const file of files) fd.append("files", file);
      const res = await fetch("/assets", { method: "POST", body: fd });
      const body = (await res.json()) as {
        ok?: boolean;
        item?: StudioAsset;
        detail?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.item) {
        throw new Error(
          (typeof body.detail === "string" ? body.detail : null) ||
            body.error ||
            "Could not save asset.",
        );
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(null);
    }
  }

  async function onGenerate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch("/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: label,
          notes: notes.trim(),
          prompt: prompt.trim(),
          model_id: modelId,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        item?: StudioAsset;
        detail?: string;
        error?: string;
      };
      if (!res.ok || !body.ok || !body.item) {
        throw new Error(
          (typeof body.detail === "string" ? body.detail : null) ||
            body.error ||
            "Generate failed.",
        );
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(null);
    }
  }

  const title = KIND_LABEL[kind];

  return (
    <div className="asset-creator-scrim" role="dialog" aria-label={`New ${title}`}>
      <div className="asset-creator studio-node">
        <div className="node-header">
          <span>New {title}</span>
          <button type="button" className="ghost" onClick={onClose} disabled={Boolean(busy)}>
            Close
          </button>
        </div>
        <div className="node-body">
          <label className="builder-field">
            <span className="field-label">Name</span>
            <input
              className="model"
              type="text"
              value={name}
              placeholder={
                kind === "character"
                  ? "Alice"
                  : kind === "scene"
                    ? "Classy bar"
                    : "Red mug"
              }
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="builder-field">
            <span className="field-label">Notes (optional)</span>
            <textarea
              className="prompt nowheel"
              rows={2}
              placeholder={
                kind === "character"
                  ? "Look, costume, age…"
                  : kind === "scene"
                    ? "Time of day, architecture…"
                    : "Material, size, color…"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <span className="field-label">
            Stills ({files.length}/{cap})
          </span>
          <div className="library-actions">
            <button
              type="button"
              className="ghost"
              disabled={Boolean(busy) || files.length >= cap}
              onClick={() => fileRef.current?.click()}
            >
              Upload still{kind === "character" ? "s" : ""}
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*"
              multiple={kind === "character"}
              onChange={(e) => {
                if (e.target.files) pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {files.length ? (
            <p className="hint">{files.map((f) => f.name).join(" · ")}</p>
          ) : (
            <p className="hint">
              {kind === "prop"
                ? "Upload a still, then Save."
                : "Upload a still, or generate a simple sheet."}
            </p>
          )}
          {canGenerate ? (
            <>
              <label className="builder-field">
                <span className="field-label">Sheet prompt (optional)</span>
                <textarea
                  className="prompt nowheel"
                  rows={2}
                  placeholder="Leave blank for a simple front-view still"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              <label className="builder-field">
                <span className="field-label">Model</span>
                <select
                  className="model"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  disabled={!models.length || Boolean(busy)}
                >
                  {models.length === 0 ? (
                    <option value="">Loading models…</option>
                  ) : (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </>
          ) : null}
          <div className="prompt-actions">
            {canGenerate ? (
              <button
                type="button"
                className="ghost"
                disabled={Boolean(busy) || !name.trim()}
                onClick={() => void onGenerate()}
              >
                {busy === "generate" ? "Generating…" : "Generate still"}
              </button>
            ) : null}
            <button
              type="button"
              className="generate"
              disabled={Boolean(busy) || !name.trim()}
              onClick={() => void onSave()}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          </div>
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
