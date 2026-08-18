import { useEffect, useMemo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import type { Mode, PromptBuilderNodeData } from "./types";

export type PromptBuilderFlowNode = Node<PromptBuilderNodeData, "builder">;

type FieldSpec = {
  id: string;
  label: string;
  type?: string;
  kind?: string;
  choices?: string[];
  value?: string;
  placeholder?: string;
};

type ScenarioSpec = {
  key: string;
  label: string;
  description?: string;
  fields?: FieldSpec[];
};

export default function PromptBuilderNode({
  data,
}: NodeProps<PromptBuilderFlowNode>) {
  const mode: Mode = data.mode || "image";
  const modality = data.modality || "";
  const [scenarios, setScenarios] = useState<ScenarioSpec[]>([]);
  const [scenarioKey, setScenarioKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setError(null);
    const qs = new URLSearchParams({ mode, modality });
    fetch(`/builder/scenarios?${qs}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Builder ${res.status}`);
        return res.json();
      })
      .then(
        (body: {
          scenarios?: ScenarioSpec[];
          default_id?: string;
        }) => {
          const rows = Array.isArray(body.scenarios) ? body.scenarios : [];
          setScenarios(rows);
          const next =
            (body.default_id && rows.some((r) => r.key === body.default_id)
              ? body.default_id
              : rows[0]?.key) || "";
          setScenarioKey(next);
          const spec = rows.find((r) => r.key === next);
          setValues(defaultsFrom(spec));
        },
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setScenarios([]);
        setScenarioKey("");
        setValues({});
        setError(
          err instanceof Error ? err.message : "Could not load scenarios.",
        );
      });
    return () => ac.abort();
  }, [mode, modality]);

  const selected = useMemo(
    () => scenarios.find((s) => s.key === scenarioKey) ?? null,
    [scenarios, scenarioKey],
  );
  const fields = selected?.fields ?? [];

  function pickScenario(key: string) {
    setScenarioKey(key);
    const spec = scenarios.find((s) => s.key === key);
    setValues(defaultsFrom(spec));
    setError(null);
  }

  async function onApply() {
    if (!scenarioKey || applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/builder/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_key: scenarioKey,
          fields: values,
          mode,
          modality,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        prompt?: string;
        detail?: string;
        error?: string;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(
          body.error ||
            (typeof body.detail === "string" ? body.detail : null) ||
            "Apply failed.",
        );
      }
      data.onApply((body.prompt || "").trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  const subtitle =
    mode === "audio"
      ? modality === "sfx"
        ? "Audio · SFX"
        : modality === "voice"
          ? "Audio · Voice"
          : "Audio · Music"
      : mode === "video"
        ? "Video"
        : mode === "frame"
          ? "Frame"
          : "Image";

  return (
    <div className="studio-node builder-node">
      <div className="node-header">
        <span>Prompt Builder</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="hint">
          {subtitle} — pick a scenario, then Apply to Prompt. Enhance stays
          optional.
        </p>
        <label className="field-label" htmlFor="builder-scenario">
          Scenario
        </label>
        <select
          id="builder-scenario"
          className="model nodrag"
          value={scenarioKey}
          onChange={(e) => pickScenario(e.target.value)}
          disabled={scenarios.length === 0}
        >
          {scenarios.length === 0 ? (
            <option value="">Loading…</option>
          ) : (
            scenarios.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}
              </option>
            ))
          )}
        </select>
        {selected?.description ? (
          <p className="hint">{selected.description}</p>
        ) : null}

        {fields.length ? (
          <div className="builder-fields">
            {fields.map((field) => (
              <BuilderField
                key={field.id}
                field={field}
                value={values[field.id] ?? field.value ?? ""}
                onChange={(next) =>
                  setValues((cur) => ({ ...cur, [field.id]: next }))
                }
              />
            ))}
          </div>
        ) : (
          <p className="hint">Choose a scenario to unlock its options.</p>
        )}

        {mode === "audio" && (modality === "music" || !modality) ? (
          <p className="hint">
            Style / arrangement stay out of the lyrics block.
          </p>
        ) : null}

        <div className="prompt-actions">
          <button
            type="button"
            className="generate nodrag"
            disabled={!scenarioKey || applying}
            onClick={() => void onApply()}
          >
            {applying ? "Applying…" : "Apply to prompt"}
          </button>
        </div>
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

function defaultsFrom(spec: ScenarioSpec | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of spec?.fields ?? []) {
    out[field.id] = field.value ?? "";
  }
  return out;
}

function BuilderField({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: string;
  onChange: (v: string) => void;
}) {
  const kind = field.type || field.kind || "select";
  if (kind === "check") {
    return (
      <label className="param check">
        <input
          type="checkbox"
          checked={value === "true" || value === "1" || value === "on"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        {field.label}
      </label>
    );
  }
  if (kind === "textarea") {
    return (
      <label className="builder-field">
        <span className="field-label">{field.label}</span>
        <textarea
          className="prompt nodrag nowheel"
          rows={4}
          placeholder={field.placeholder || ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }
  if (kind === "text") {
    return (
      <label className="builder-field">
        <span className="field-label">{field.label}</span>
        <input
          className="model nodrag"
          type="text"
          placeholder={field.placeholder || ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }
  return (
    <label className="builder-field">
      <span className="field-label">{field.label}</span>
      <select
        className="model nodrag"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.choices ?? []).map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </label>
  );
}
