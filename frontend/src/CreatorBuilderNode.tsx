import { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import { toast } from "./toast";
import {
  CORE_SLOTS,
  EXTRA_SLOTS,
  SLOT_LABEL,
  WARDROBE_F,
  WARDROBE_M,
  useSheetEstimate,
  useSheetModels,
} from "./sheetUi";
import type {
  CreatorBuilderNodeData,
  StudioAsset,
} from "./types";

export type CreatorBuilderFlowNode = Node<CreatorBuilderNodeData, "creator-builder">;

type GenBody = {
  ok?: boolean;
  item?: StudioAsset;
  prompt?: string;
  detail?: string;
  error?: string;
};

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function errOf(body: GenBody, fallback: string) {
  return (
    (typeof body.detail === "string" ? body.detail : null) ||
    body.error ||
    fallback
  );
}

export default function CreatorBuilderNode({
  data,
}: NodeProps<CreatorBuilderFlowNode>) {
  const kind = data.kind;
  return (
    <div className="studio-node creator-builder-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>
          {kind === "costume"
            ? "Costume Designer"
            : kind === "scene"
              ? "Scene Builder"
              : kind === "prop"
                ? "Prop Builder"
                : "Character Builder"}
        </span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        {kind === "scene" ? (
          <SceneForm data={data} />
        ) : kind === "prop" ? (
          <PropForm data={data} />
        ) : kind === "costume" ? (
          <CostumeForm data={data} />
        ) : (
          <CharacterForm data={data} />
        )}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

function CharacterForm({ data }: { data: CreatorBuilderNodeData }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [age, setAge] = useState("30s");
  const [build, setBuild] = useState("average");
  const [hair, setHair] = useState("dark brown short");
  const [face, setFace] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideWardrobe, setOverrideWardrobe] = useState(false);
  const [wardrobe, setWardrobe] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const models = useSheetModels();
  const locked = gender === "Female" ? WARDROBE_F : WARDROBE_M;
  const slots = useMemo(() => [...CORE_SLOTS, ...extras], [extras]);
  const estimate = useSheetEstimate(
    "character",
    models.t2iId,
    models.r2iId,
    slots,
  );

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setReady(false);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "character",
          name: label,
          notes: notes.trim(),
          fields: {
            gender,
            age,
            build,
            hair,
            face: face.trim(),
            wardrobe: overrideWardrobe ? wardrobe.trim() : locked,
            notes: notes.trim(),
          },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      setAssetId(draft.item.id);
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots,
      });
      let prior = "";
      let last = draft.item;
      for (const slot of slots) {
        const promptRes = await fetch("/assets/sheet/prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "character",
            slot,
            name: label,
            fields: draft.item.fields || {},
          }),
        });
        const promptBody = await readJson<GenBody>(promptRes);
        data.onAngle(slot, {
          slot,
          label: SLOT_LABEL[slot] || slot,
          prompt: promptBody.prompt || "",
          generating: true,
          error: null,
        });
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: draft.item.id,
            slot,
            model_id: slot === "front" ? models.t2iId : models.r2iId || models.t2iId,
            source_still: prior,
            wardrobe: overrideWardrobe ? wardrobe.trim() : locked,
          }),
        });
        const body = await readJson<GenBody>(res);
        if (!res.ok || !body.item) {
          data.onAngle(slot, {
            slot,
            generating: false,
            error: errOf(body, `${SLOT_LABEL[slot] || slot} failed.`),
          });
          throw new Error(errOf(body, `${SLOT_LABEL[slot] || slot} failed.`));
        }
        last = body.item;
        const path = body.item.identity?.[slot] || body.item.still_path || "";
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        prior = path;
        data.onAngle(slot, {
          slot,
          prompt: body.item.prompt || promptBody.prompt || "",
          path,
          url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
          generating: false,
          error: null,
        });
      }
      const have = CORE_SLOTS.every((s) => last.identity?.[s]);
      setReady(have);
      toast(`Generated ${slots.length} angles.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!assetId || !ready) {
      setError("Generate Front, Side, and Close-up first.");
      return;
    }
    data.onSaved({
      id: assetId,
      name: name.trim(),
      kind: "character",
      has_still: true,
      still_path: assetId,
      url: `/assets/${assetId}/still`,
    });
  }

  return (
    <>
      <p className="hint">Identity + models. Generate drops angle nodes on the canvas.</p>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <label className="param">
          <span>Gender</span>
          <select
            className="model"
            value={gender}
            onChange={(e) => setGender(e.target.value as "Male" | "Female")}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>
        <label className="param">
          <span>Age</span>
          <select className="model" value={age} onChange={(e) => setAge(e.target.value)}>
            {["20s", "30s", "40s", "50s", "60+"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="param">
          <span>Build</span>
          <select className="model" value={build} onChange={(e) => setBuild(e.target.value)}>
            {["slim", "average", "athletic", "heavy"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="builder-field">
        <span className="field-label">Hair</span>
        <select className="model" value={hair} onChange={(e) => setHair(e.target.value)}>
          {[
            "black short",
            "dark brown short",
            "brown medium",
            "blonde long",
            "red wavy",
            "gray short",
            "bald",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label className="builder-field">
        <span className="field-label">Face notes</span>
        <input className="model" value={face} onChange={(e) => setFace(e.target.value)} />
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
      <label className="builder-field">
        <span className="field-label">
          <input
            type="checkbox"
            checked={overrideWardrobe}
            onChange={(e) => setOverrideWardrobe(e.target.checked)}
          />{" "}
          Override base wardrobe
        </span>
        <textarea
          className="prompt nowheel"
          rows={2}
          disabled={!overrideWardrobe}
          value={overrideWardrobe ? wardrobe : locked}
          onChange={(e) => setWardrobe(e.target.value)}
        />
      </label>
      <span className="field-label">Extra angles</span>
      <div className="chip-row">
        {EXTRA_SLOTS.map((id) => (
          <button
            key={id}
            type="button"
            className={extras.includes(id) ? "pill modality on" : "pill modality"}
            onClick={() =>
              setExtras((cur) =>
                cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
              )
            }
          >
            {SLOT_LABEL[id]}
          </button>
        ))}
      </div>
      <ModelPickers models={models} />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy || !name.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate Base Sheet"}
        </button>
        <button type="button" className="ghost" disabled={busy || !ready} onClick={save}>
          Save Character
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function CostumeForm({ data }: { data: CreatorBuilderNodeData }) {
  const [bases, setBases] = useState<StudioAsset[]>(data.bases ?? []);
  const [parentId, setParentId] = useState(data.bases?.[0]?.id || "");
  const [name, setName] = useState("");
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [footwear, setFootwear] = useState("");
  const [extra, setExtra] = useState("");
  const [costumeRef, setCostumeRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const models = useSheetModels();
  const estimate = useSheetEstimate("costume", models.t2iId, models.r2iId, [
    ...CORE_SLOTS,
  ]);

  useEffect(() => {
    fetch("/assets?kind=character")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: StudioAsset[] }) => {
        const rows = (body.items ?? []).filter((a) => !a.parent_id && a.has_still);
        setBases(rows);
        setParentId((cur) => cur || rows[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  async function generate() {
    const outfitName = name.trim();
    const outfit = [top, bottom, footwear, extra].map((s) => s.trim()).filter(Boolean).join(". ");
    if (!outfitName) {
      setError("Costume name is required.");
      return;
    }
    if (!parentId) {
      setError("Pick a base character.");
      return;
    }
    if (!outfit && !costumeRef) {
      setError("Describe the wardrobe or upload a costume still.");
      return;
    }
    setBusy(true);
    setError(null);
    setReady(false);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "character",
          name: outfitName,
          parent_id: parentId,
          notes: extra.trim(),
          fields: { wardrobe: outfit },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      setAssetId(draft.item.id);
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots: [...CORE_SLOTS],
      });
      const parent = bases.find((b) => b.id === parentId);
      let prior = parent?.still_path || "";
      let last = draft.item;
      for (const slot of CORE_SLOTS) {
        data.onAngle(slot, {
          slot,
          label: SLOT_LABEL[slot] || slot,
          generating: true,
          error: null,
        });
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: draft.item.id,
            slot,
            model_id: models.r2iId || models.t2iId,
            source_still: prior,
            costume_ref: costumeRef,
            wardrobe: outfit,
          }),
        });
        const body = await readJson<GenBody>(res);
        if (!res.ok || !body.item) {
          data.onAngle(slot, {
            slot,
            generating: false,
            error: errOf(body, `${slot} failed.`),
          });
          throw new Error(errOf(body, `${slot} failed.`));
        }
        last = body.item;
        const path = body.item.identity?.[slot] || body.item.still_path || "";
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        prior = path;
        data.onAngle(slot, {
          slot,
          prompt: body.item.prompt || "",
          path,
          url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
          generating: false,
          error: null,
        });
      }
      setReady(CORE_SLOTS.every((s) => last.identity?.[s]));
      toast(`Generated costume ${outfitName}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Costume generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="builder-field">
        <span className="field-label">Base character</span>
        <select
          className="model"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          {bases.length === 0 ? (
            <option value="">No base sheets yet</option>
          ) : (
            bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label || b.name}
              </option>
            ))
          )}
        </select>
      </label>
      <label className="builder-field">
        <span className="field-label">Costume name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Top</span>
        <input className="model" value={top} onChange={(e) => setTop(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Bottom</span>
        <input className="model" value={bottom} onChange={(e) => setBottom(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Footwear</span>
        <input
          className="model"
          value={footwear}
          onChange={(e) => setFootwear(e.target.value)}
        />
      </label>
      <label className="builder-field">
        <span className="field-label">Extra</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
        />
      </label>
      <div className="library-actions">
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
          {costumeRef ? "Costume still attached" : "Upload costume still"}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append("files", file);
            void fetch("/library/import", { method: "POST", body: fd })
              .then((res) => res.json())
              .then((body: { items?: { path?: string }[] }) => {
                setCostumeRef(body.items?.[0]?.path || "");
              });
            e.target.value = "";
          }}
        />
      </div>
      <ModelPickers models={models} r2iOnly />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate costume sheet"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={busy || !ready || !assetId}
          onClick={() =>
            assetId &&
            data.onSaved({
              id: assetId,
              name: name.trim(),
              kind: "character",
              parent_id: parentId,
              is_costume: true,
              has_still: true,
              url: `/assets/${assetId}/still`,
            })
          }
        >
          Save costume
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function SceneForm({ data }: { data: CreatorBuilderNodeData }) {
  const [name, setName] = useState("");
  const [setting, setSetting] = useState("interior");
  const [time, setTime] = useState("day");
  const [mood, setMood] = useState("calm");
  const [elements, setElements] = useState("");
  const [notes, setNotes] = useState("");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const slots = sheet ? ["front", "side"] : ["front"];
  const estimate = useSheetEstimate("scene", models.t2iId, models.r2iId, slots);

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "scene",
          name: label,
          notes: notes.trim(),
          fields: { setting, time, mood, elements: elements.trim(), notes: notes.trim() },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots,
      });
      let prior = "";
      let last = draft.item;
      for (const slot of slots) {
        data.onAngle(slot, {
          slot,
          label: slot === "front" ? "Hero" : "Detail",
          generating: true,
          error: null,
        });
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: draft.item.id,
            slot,
            model_id: slot === "front" ? models.t2iId : models.r2iId || models.t2iId,
            source_still: prior,
          }),
        });
        const body = await readJson<GenBody>(res);
        if (!res.ok || !body.item) {
          data.onAngle(slot, { slot, generating: false, error: errOf(body, "Failed.") });
          throw new Error(errOf(body, "Failed."));
        }
        last = body.item;
        const path = body.item.identity?.[slot] || body.item.still_path || "";
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        prior = path;
        data.onAngle(slot, {
          slot,
          prompt: body.item.prompt || "",
          path,
          url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
          generating: false,
          error: null,
        });
      }
      data.onSaved(last);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scene generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <label className="param">
          <span>Setting</span>
          <select className="model" value={setting} onChange={(e) => setSetting(e.target.value)}>
            <option>interior</option>
            <option>exterior</option>
          </select>
        </label>
        <label className="param">
          <span>Time</span>
          <select className="model" value={time} onChange={(e) => setTime(e.target.value)}>
            {["dawn", "day", "golden hour", "dusk", "night"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="param">
          <span>Mood</span>
          <select className="model" value={mood} onChange={(e) => setMood(e.target.value)}>
            {["calm", "tense", "romantic", "gritty", "luxurious", "playful"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="builder-field">
        <span className="field-label">Key elements</span>
        <input className="model" value={elements} onChange={(e) => setElements(e.target.value)} />
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
      <label className="builder-field">
        <span className="field-label">
          <input type="checkbox" checked={sheet} onChange={(e) => setSheet(e.target.checked)} />{" "}
          Second angle
        </span>
      </label>
      <ModelPickers models={models} />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy || !name.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate scene"}
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function PropForm({ data }: { data: CreatorBuilderNodeData }) {
  const [name, setName] = useState("");
  const [ptype, setPtype] = useState("object");
  const [material, setMaterial] = useState("metal");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const estimate = useSheetEstimate("prop", models.t2iId, models.r2iId, ["front"]);

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "prop",
          name: label,
          notes: notes.trim(),
          fields: { ptype, material, color: color.trim(), notes: notes.trim() },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots: ["front"],
      });
      data.onAngle("front", {
        slot: "front",
        label: "Still",
        generating: true,
        error: null,
      });
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: draft.item.id,
          slot: "front",
          model_id: models.t2iId,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) {
        data.onAngle("front", { slot: "front", generating: false, error: errOf(body, "Failed.") });
        throw new Error(errOf(body, "Failed."));
      }
      const url = body.item.url || "";
      data.onAngle("front", {
        slot: "front",
        prompt: body.item.prompt || "",
        path: body.item.still_path || "",
        url: url ? `${url}?t=${Date.now()}` : "",
        generating: false,
        error: null,
      });
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prop generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <label className="param">
          <span>Type</span>
          <select className="model" value={ptype} onChange={(e) => setPtype(e.target.value)}>
            {["object", "handheld", "furniture", "vehicle", "food", "other"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="param">
          <span>Material</span>
          <select className="model" value={material} onChange={(e) => setMaterial(e.target.value)}>
            {["metal", "wood", "plastic", "glass", "fabric", "ceramic", "mixed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="builder-field">
        <span className="field-label">Color</span>
        <input className="model" value={color} onChange={(e) => setColor(e.target.value)} />
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
      <ModelPickers models={models} t2iOnly />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy || !name.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate still"}
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function ModelPickers({
  models,
  t2iOnly,
  r2iOnly,
}: {
  models: ReturnType<typeof useSheetModels>;
  t2iOnly?: boolean;
  r2iOnly?: boolean;
}) {
  return (
    <div className="params">
      {!r2iOnly ? (
        <label className="param">
          <span>Front model (T2I)</span>
          <select
            className="model"
            value={models.t2iId}
            onChange={(e) => models.setT2iId(e.target.value)}
          >
            {models.t2i.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!t2iOnly ? (
        <label className="param">
          <span>Angle model (R2I)</span>
          <select
            className="model"
            value={models.r2iId}
            onChange={(e) => models.setR2iId(e.target.value)}
          >
            {models.r2i.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
