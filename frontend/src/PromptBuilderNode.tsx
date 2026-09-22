import { useEffect, useMemo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import { readJson } from "./http";
import { toast } from "./toast";
import CreativeEnhanceToggle from "./CreativeEnhanceToggle";
import { useXaiKey } from "./useXaiKey";
import {
  CORE_INSTRUMENTS,
  MUSIC_BUILDS,
  MUSIC_ENDINGS,
  MUSIC_ENERGY,
  MUSIC_ERAS,
  MUSIC_FLARES,
  MUSIC_GENRES,
  MUSIC_INTROS,
  MUSIC_MOODS,
  MUSIC_TEMPO,
  MUSIC_SECTIONS,
  MUSIC_USE_CASES,
  MUSIC_VOICE_CHARACTER,
  MUSIC_VOCALS,
  composeMusicLyrics,
  composeMusicStyle,
  liftTimbre,
  scrubSungLyrics,
  shapeSungLyrics,
  regionalFor,
  regionalTip,
  subgenresFor,
} from "./musicUi";
import type { AceEnhancePack, Mode, PromptBuilderNodeData } from "./types";

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
  const isMusic = mode === "audio" && (modality === "music" || !modality);
  const [scenarios, setScenarios] = useState<ScenarioSpec[]>([]);
  const [scenarioKey, setScenarioKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [creativeEnhance, setCreativeEnhance] = useState(false);
  const hasXai = useXaiKey();

  useEffect(() => {
    if (isMusic) return;
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
  }, [isMusic, mode, modality]);

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

  async function composeScenarioPrompt(): Promise<string> {
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
    return (body.prompt || "").trim();
  }

  async function onApply() {
    if (!scenarioKey || applying) return;
    setApplying(true);
    setError(null);
    try {
      data.onApply(await composeScenarioPrompt());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  async function onEnhanceScenario() {
    if (!scenarioKey || enhancing || applying) return;
    setEnhancing(true);
    setError(null);
    try {
      const raw = await composeScenarioPrompt();
      if (!raw) throw new Error("Apply selection first so Enhance has a prompt.");
      const res = await fetch("/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: raw,
          mode,
          modality,
          creative: creativeEnhance,
        }),
      });
      const body = (await readJson(res)) as {
        ok?: boolean;
        prompt?: string;
        error?: string;
        detail?: string;
      };
      const rewritten = (body.prompt || "").trim();
      if (!res.ok || body.ok === false || !rewritten) {
        throw new Error(
          (typeof body.detail === "string" && body.detail) ||
            body.error ||
            "Enhance returned an empty reply.",
        );
      }
      data.onApply(rewritten);
      toast("Enhanced prompt applied.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enhance failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setEnhancing(false);
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

  if (isMusic) {
    return <MusicForm data={data} />;
  }

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
          <button
            type="button"
            className="ghost enhance nodrag"
            disabled={!scenarioKey || enhancing || applying}
            onClick={() => void onEnhanceScenario()}
          >
            {enhancing ? "Enhancing…" : "Enhance"}
          </button>
          <CreativeEnhanceToggle
            checked={creativeEnhance}
            onChange={setCreativeEnhance}
            hasXai={hasXai}
          />
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

function ChipMulti({
  options,
  selected,
  onToggle,
  titleFor,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
  titleFor?: (v: string) => string;
}) {
  return (
    <div className="chip-row">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={selected.includes(opt) ? "pill modality on" : "pill modality"}
          title={titleFor?.(opt) || undefined}
          onClick={() => onToggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SkipSelect({
  label,
  value,
  options,
  onChange,
  extra,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  extra?: string;
}) {
  const opts = extra && !options.includes(extra) ? [...options, extra] : [...options];
  return (
    <label className="param">
      <span>{label}</span>
      <select className="model nodrag" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="Custom">Custom</option>
      </select>
    </label>
  );
}

function MusicForm({ data }: { data: PromptBuilderNodeData }) {
  const instrumental = data.instrumental === true;
  const [genre, setGenre] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [flare, setFlare] = useState("");
  const [flareCustom, setFlareCustom] = useState("");
  const [era, setEra] = useState("");
  const [energy, setEnergy] = useState("forward");
  const [tempo, setTempo] = useState("driving (~120 BPM)");
  const [tempoCustom, setTempoCustom] = useState("");
  const [mood, setMood] = useState("");
  const [instruments, setInstruments] = useState<string[]>([
    "electric guitar",
    "bass",
    "drums",
  ]);
  const [regional, setRegional] = useState<string[]>([]);
  const [vocals, setVocals] = useState("");
  const [voiceCharacter, setVoiceCharacter] = useState<string[]>([]);
  const [intro, setIntro] = useState("cold-open riff");
  const [buildup, setBuildup] = useState("kick in at ~8s");
  const [ending, setEnding] = useState("hard stop");
  const [sections, setSections] = useState<string[]>([]);
  const [useCase, setUseCase] = useState("");
  const [notes, setNotes] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [creativeEnhance, setCreativeEnhance] = useState(false);
  const hasXai = useXaiKey();
  const [error, setError] = useState<string | null>(null);

  const subs = subgenresFor(genre);
  const flareKey = flare === "Custom" ? flareCustom : flare;
  const regionalOpts = regionalFor(flareKey);

  useEffect(() => {
    if (subgenre && !subs.includes(subgenre)) setSubgenre("");
  }, [genre, subgenre, subs]);

  useEffect(() => {
    const opts = regionalFor(flareKey);
    setRegional((cur) => cur.filter((x) => opts.includes(x)));
  }, [flareKey]);

  function toggle(list: string[], value: string, set: (next: string[]) => void) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  const fields = {
    genre,
    subgenre,
    flare: flare === "Custom" ? "" : flare,
    flareCustom: flare === "Custom" ? flareCustom : "",
    era,
    energy,
    tempo: tempo === "Custom" ? "" : tempo,
    tempoCustom: tempo === "Custom" ? tempoCustom : "",
    mood,
    instruments,
    regional,
    vocals,
    voiceCharacter,
    intro,
    buildup,
    ending,
    sections,
    useCase,
    notes,
    instrumental,
  };
  const liveStyle = composeMusicStyle(fields);
  const liveLyrics = composeMusicLyrics(fields);

  function applySelection() {
    const style = liveStyle.trim();
    const lyrics = liveLyrics.trim();
    if (!style) {
      setError("Pick at least a genre or an instrument.");
      return;
    }
    if (!lyrics.includes("[")) {
      setError("Lyrics need a [Section] tag.");
      return;
    }
    const pack: AceEnhancePack = { tags: style, lyrics, instrumental };
    data.onApply(style, pack);
    toast("Applied Style and Lyrics.");
    setError(null);
  }

  async function onEnhance() {
    const style = liveStyle.trim();
    const lyrics = liveLyrics.trim();
    if (!style || !lyrics.includes("[")) {
      setError("Apply selection first so Enhance has Style and Lyrics.");
      return;
    }
    setEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: style,
          lyrics,
          notes,
          model_id: data.modelId || "",
          mode: "audio",
          modality: "music",
          creative: creativeEnhance,
          instrumental,
        }),
      });
      const body = (await readJson(res)) as {
        ok?: boolean;
        prompt?: string;
        style?: string;
        tags?: string;
        lyrics?: string;
        bpm?: number | string;
        keyscale?: string;
        timesignature?: string;
        language?: string;
        instrumental?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(
          (typeof body.detail === "string" && body.detail) ||
            body.error ||
            "Enhance failed.",
        );
      }
      let nextStyle = (body.style || body.tags || body.prompt || style).trim();
      let nextLyrics = (body.lyrics || "").trim();
      if (!nextLyrics.includes("[")) nextLyrics = lyrics;
      if (!instrumental) {
        const scrubbed = scrubSungLyrics(nextLyrics, notes);
        const lifted = liftTimbre(nextStyle, scrubbed);
        nextLyrics = shapeSungLyrics(lifted.lyrics, creativeEnhance);
        nextStyle = lifted.style;
      }
      const pack: AceEnhancePack = {
        tags: nextStyle,
        lyrics: nextLyrics,
        bpm: body.bpm,
        keyscale: body.keyscale,
        timesignature: body.timesignature,
        language: body.language,
        instrumental: body.instrumental ?? instrumental,
      };
      data.onApply(nextStyle, pack);
      toast("Enhanced Style and Lyrics.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enhance failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className="studio-node builder-node music-builder">
      <div className="node-header">
        <span>Music Prompt Builder</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="hint">
          Core genre first. Flare is a secondary color only — it never replaces the
          genre. Cost stays on the Prompt node (duration × model).
        </p>
        <div className="params">
          <SkipSelect label="Genre" value={genre} options={MUSIC_GENRES} onChange={setGenre} />
          <SkipSelect
            label="Sub-genre"
            value={subgenre}
            options={subs}
            onChange={setSubgenre}
          />
        </div>
        <div className="params">
          <SkipSelect label="Flare" value={flare} options={MUSIC_FLARES} onChange={setFlare} />
          <SkipSelect label="Era" value={era} options={MUSIC_ERAS} onChange={setEra} />
        </div>
        {flare === "Custom" ? (
          <label className="builder-field">
            <span className="field-label">Custom flare</span>
            <input
              className="model nodrag"
              value={flareCustom}
              placeholder="e.g. Peru, Andes…"
              onChange={(e) => setFlareCustom(e.target.value)}
            />
          </label>
        ) : null}
        <div className="params">
          <SkipSelect label="Energy" value={energy} options={MUSIC_ENERGY} onChange={setEnergy} />
          <SkipSelect label="Tempo" value={tempo} options={MUSIC_TEMPO} onChange={setTempo} extra={tempoCustom} />
          <SkipSelect label="Mood" value={mood} options={MUSIC_MOODS} onChange={setMood} />
        </div>
        {tempo === "Custom" ? (
          <label className="builder-field">
            <span className="field-label">BPM</span>
            <input
              className="model nodrag"
              value={tempoCustom}
              placeholder="e.g. 118 BPM"
              onChange={(e) => setTempoCustom(e.target.value)}
            />
          </label>
        ) : null}
        <span className="field-label">Instrumentation</span>
        <ChipMulti
          options={CORE_INSTRUMENTS}
          selected={instruments}
          onToggle={(v) => toggle(instruments, v, setInstruments)}
        />
        {regionalOpts.length ? (
          <>
            <span className="field-label">Regional color ({flareKey})</span>
            <ChipMulti
              options={regionalOpts}
              selected={regional}
              onToggle={(v) => toggle(regional, v, setRegional)}
              titleFor={regionalTip}
            />
          </>
        ) : null}
        <label className="param check">
          <input
            type="checkbox"
            checked={instrumental}
            onChange={(e) => data.onInstrumental?.(e.target.checked)}
          />
          Instrumental
        </label>
        {instrumental ? (
          <p className="hint">Same checkbox as the Prompt node. Vocals stay off.</p>
        ) : (
          <>
            <div className="params">
              <SkipSelect label="Vocals" value={vocals} options={MUSIC_VOCALS} onChange={setVocals} />
            </div>
            <span className="field-label">Voice character (max 2)</span>
            <ChipMulti
              options={MUSIC_VOICE_CHARACTER}
              selected={voiceCharacter}
              onToggle={(value) =>
                setVoiceCharacter((cur) => {
                  if (cur.includes(value)) return cur.filter((item) => item !== value);
                  if (cur.length >= 2) return cur;
                  return [...cur, value];
                })
              }
            />
          </>
        )}
        <span className="field-label">Structure</span>
        <div className="params">
          <SkipSelect label="Intro" value={intro} options={MUSIC_INTROS} onChange={setIntro} />
          <SkipSelect label="Buildup" value={buildup} options={MUSIC_BUILDS} onChange={setBuildup} />
          <SkipSelect label="Ending" value={ending} options={MUSIC_ENDINGS} onChange={setEnding} />
        </div>
        <span className="field-label">Sections</span>
        <ChipMulti
          options={MUSIC_SECTIONS}
          selected={sections}
          onToggle={(v) => toggle(sections, v, setSections)}
        />
        <div className="params">
          <SkipSelect
            label="Use case"
            value={useCase}
            options={MUSIC_USE_CASES}
            onChange={setUseCase}
          />
        </div>
        <label className="builder-field">
          <span className="field-label">Notes</span>
          <textarea
            className="prompt nodrag nowheel"
            rows={2}
            placeholder="Optional extras"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="builder-field">
          <span className="field-label">Style</span>
          <textarea className="prompt nodrag nowheel" rows={4} readOnly value={liveStyle} />
        </label>
        <label className="builder-field">
          <span className="field-label">Lyrics</span>
          <textarea className="prompt nodrag nowheel" rows={6} readOnly value={liveLyrics} />
        </label>
        <div className="prompt-actions">
          <button type="button" className="generate nodrag" onClick={applySelection}>
            Apply selection
          </button>
          <button
            type="button"
            className="ghost enhance nodrag"
            disabled={enhancing}
            onClick={() => void onEnhance()}
          >
            {enhancing ? "Enhancing…" : "Enhance"}
          </button>
          <CreativeEnhanceToggle
            checked={creativeEnhance}
            onChange={setCreativeEnhance}
            hasXai={hasXai}
          />
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
