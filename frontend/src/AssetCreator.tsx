import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "./toast";
import {
  CORE_SLOTS,
  EXTRA_SLOTS,
  SLOT_LABEL,
  useSheetEstimate,
  useSheetModels,
} from "./sheetUi";
import type { AssetRole, StudioAsset } from "./types";

type Props = {
  kind: AssetRole;
  onClose: () => void;
  onSaved: (asset: StudioAsset) => void;
};

type CharTab = "base" | "costume";
type AngleStatus = "idle" | "run" | "ok" | "err";

const CORE = CORE_SLOTS;
const EXTRA = EXTRA_SLOTS;

const AGES = ["20s", "30s", "40s", "50s", "60+"];
const BUILDS = ["slim", "average", "athletic", "heavy"];
const HAIRS = [
  "black short",
  "dark brown short",
  "brown medium",
  "blonde long",
  "red wavy",
  "gray short",
  "bald",
];
const SETTINGS = ["interior", "exterior"];
const TIMES = ["dawn", "day", "golden hour", "dusk", "night"];
const MOODS = ["calm", "tense", "romantic", "gritty", "luxurious", "playful"];
const PROP_TYPES = ["object", "handheld", "furniture", "vehicle", "food", "other"];
const MATERIALS = ["metal", "wood", "plastic", "glass", "fabric", "ceramic", "mixed"];

const WARDROBE_M =
  "simple neutral athletic wear, non-revealing, studio character reference";
const WARDROBE_F =
  "simple neutral athletic wear, non-revealing, studio character reference";

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

type GenBody = {
  ok?: boolean;
  item?: StudioAsset;
  detail?: string;
  error?: string;
};

export default function AssetCreator({ kind, onClose, onSaved }: Props) {
  if (kind === "scene") return <SceneBuilder onClose={onClose} onSaved={onSaved} />;
  if (kind === "prop") return <PropBuilder onClose={onClose} onSaved={onSaved} />;
  return <CharacterBuilder onClose={onClose} onSaved={onSaved} />;
}

function CharacterBuilder({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (asset: StudioAsset) => void;
}) {
  const [tab, setTab] = useState<CharTab>("base");
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
  const [status, setStatus] = useState<Record<string, AngleStatus>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bases, setBases] = useState<StudioAsset[]>([]);
  const [parentId, setParentId] = useState("");
  const [costumeName, setCostumeName] = useState("");
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [footwear, setFootwear] = useState("");
  const [costumeExtra, setCostumeExtra] = useState("");
  const [costumeRef, setCostumeRef] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const models = useSheetModels();
  const lockedWardrobe = gender === "Female" ? WARDROBE_F : WARDROBE_M;
  const slots = useMemo(() => [...CORE, ...extras], [extras]);
  const estimate = useSheetEstimate(
    tab === "costume" ? "costume" : "character",
    models.t2iId,
    models.r2iId,
    tab === "base" ? slots : [...CORE],
  );

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

  function toggleExtra(id: string) {
    setExtras((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function uploadCostumeRef(file: File) {
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch("/library/import", { method: "POST", body: fd });
    const body = (await res.json()) as { items?: { path?: string }[] };
    const path = body.items?.[0]?.path || "";
    if (!path) throw new Error("Could not import costume still.");
    setCostumeRef(path);
  }

  async function createDraft(kindFields: {
    name: string;
    notes: string;
    parent_id?: string;
    fields: Record<string, string>;
  }) {
    const res = await fetch("/assets/sheet/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "character", ...kindFields }),
    });
    const body = await readJson<GenBody>(res);
    if (!res.ok || !body.ok || !body.item) {
      throw new Error(
        (typeof body.detail === "string" ? body.detail : null) ||
          body.error ||
          "Could not create character.",
      );
    }
    return body.item;
  }

  async function runAngle(
    assetId: string,
    slot: string,
    opts?: { wardrobe?: string; costumeRef?: string; isFront?: boolean },
  ) {
    setStatus((cur) => ({ ...cur, [slot]: "run" }));
    const res = await fetch("/assets/sheet/angle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_id: assetId,
        slot,
        model_id: opts?.isFront ? models.t2iId : models.r2iId || models.t2iId,
        costume_ref: opts?.costumeRef || "",
        wardrobe: opts?.wardrobe || "",
      }),
    });
    const body = await readJson<GenBody>(res);
    if (!res.ok || !body.ok || !body.item) {
      setStatus((cur) => ({ ...cur, [slot]: "err" }));
      throw new Error(
        (typeof body.detail === "string" ? body.detail : null) ||
          body.error ||
          `${SLOT_LABEL[slot] || slot} failed.`,
      );
    }
    const url = body.item.identity_urls?.[slot] || body.item.url || "";
    if (url) setThumbs((cur) => ({ ...cur, [slot]: `${url}&t=${Date.now()}` }));
    setStatus((cur) => ({ ...cur, [slot]: "ok" }));
    return body.item;
  }

  async function generateBase() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus({});
    setThumbs({});
    try {
      const draft = await createDraft({
        name: label,
        notes: notes.trim(),
        fields: {
          gender,
          age,
          build,
          hair,
          face: face.trim(),
          wardrobe: overrideWardrobe ? wardrobe.trim() : lockedWardrobe,
          notes: notes.trim(),
        },
      });
      let last = draft;
      for (const slot of slots) {
        last = await runAngle(draft.id, slot, {
          isFront: slot === "front",
          wardrobe: overrideWardrobe ? wardrobe.trim() : lockedWardrobe,
        });
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      toast(`Saved ${label} (${slots.length} angles).`);
      onSaved(last);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sheet generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  async function generateCostume() {
    const outfitName = costumeName.trim();
    if (!outfitName) {
      setError("Costume name is required.");
      return;
    }
    if (!parentId) {
      setError("Pick a base character.");
      return;
    }
    const outfit = [top, bottom, footwear, costumeExtra]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(". ");
    if (!outfit && !costumeRef) {
      setError("Describe the wardrobe or upload a costume still.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus({});
    setThumbs({});
    try {
      const draft = await createDraft({
        name: outfitName,
        notes: costumeExtra.trim(),
        parent_id: parentId,
        fields: { wardrobe: outfit },
      });
      let last = draft;
      for (const slot of CORE) {
        last = await runAngle(draft.id, slot, {
          isFront: slot === "front",
          wardrobe: outfit,
          costumeRef,
        });
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      toast(`Saved costume ${outfitName}.`);
      onSaved(last);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Costume generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="asset-creator-scrim" role="dialog" aria-label="Character builder">
      <div className="asset-creator studio-node asset-creator-wide">
        <div className="node-header">
          <span>Character builder</span>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <div className="node-body">
          <div className="pills chips">
            <button
              type="button"
              className={tab === "base" ? "pill mode on" : "pill mode"}
              onClick={() => setTab("base")}
              disabled={busy}
            >
              Base sheet
            </button>
            <button
              type="button"
              className={tab === "costume" ? "pill mode on" : "pill mode"}
              onClick={() => setTab("costume")}
              disabled={busy}
            >
              Costume Designer
            </button>
          </div>

          {tab === "base" ? (
            <>
              <label className="builder-field">
                <span className="field-label">Name</span>
                <input
                  className="model"
                  value={name}
                  placeholder="Alice"
                  onChange={(e) => setName(e.target.value)}
                />
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
                    {AGES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="param">
                  <span>Build</span>
                  <select
                    className="model"
                    value={build}
                    onChange={(e) => setBuild(e.target.value)}
                  >
                    {BUILDS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="builder-field">
                <span className="field-label">Hair</span>
                <select className="model" value={hair} onChange={(e) => setHair(e.target.value)}>
                  {HAIRS.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </label>
              <label className="builder-field">
                <span className="field-label">Face notes</span>
                <input
                  className="model"
                  value={face}
                  placeholder="sharp jaw, light stubble…"
                  onChange={(e) => setFace(e.target.value)}
                />
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
                  value={overrideWardrobe ? wardrobe : lockedWardrobe}
                  onChange={(e) => setWardrobe(e.target.value)}
                />
              </label>
              <p className="hint">
                Base wardrobe stays simple neutral athletic wear unless you override.
                Costume Designer is for outfits.
              </p>
              <span className="field-label">Extra angles</span>
              <div className="chip-row">
                {EXTRA.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={extras.includes(id) ? "pill modality on" : "pill modality"}
                    onClick={() => toggleExtra(id)}
                  >
                    {SLOT_LABEL[id]}
                  </button>
                ))}
              </div>
            </>
          ) : (
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
                <input
                  className="model"
                  value={costumeName}
                  placeholder="Red dress"
                  onChange={(e) => setCostumeName(e.target.value)}
                />
              </label>
              <label className="builder-field">
                <span className="field-label">Top</span>
                <input
                  className="model"
                  value={top}
                  placeholder="black leather jacket"
                  onChange={(e) => setTop(e.target.value)}
                />
              </label>
              <label className="builder-field">
                <span className="field-label">Bottom</span>
                <input
                  className="model"
                  value={bottom}
                  placeholder="dark jeans"
                  onChange={(e) => setBottom(e.target.value)}
                />
              </label>
              <label className="builder-field">
                <span className="field-label">Footwear</span>
                <input
                  className="model"
                  value={footwear}
                  placeholder="boots"
                  onChange={(e) => setFootwear(e.target.value)}
                />
              </label>
              <label className="builder-field">
                <span className="field-label">Extra / free wardrobe</span>
                <textarea
                  className="prompt nowheel"
                  rows={2}
                  value={costumeExtra}
                  onChange={(e) => setCostumeExtra(e.target.value)}
                />
              </label>
              <div className="library-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {costumeRef ? "Costume still attached" : "Upload costume still"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadCostumeRef(file).catch((err: unknown) => {
                      toast(err instanceof Error ? err.message : "Import failed.", true);
                    });
                    e.target.value = "";
                  }}
                />
              </div>
            </>
          )}

          <div className="params">
            <label className="param">
              <span>Front model (T2I)</span>
              <select
                className="model"
                value={models.t2iId}
                onChange={(e) => models.setT2iId(e.target.value)}
                disabled={!models.t2i.length || busy}
              >
                {models.t2i.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="param">
              <span>Angle model (R2I)</span>
              <select
                className="model"
                value={models.r2iId}
                onChange={(e) => models.setR2iId(e.target.value)}
                disabled={!models.r2i.length || busy}
              >
                {models.r2i.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <AngleProgress
            slots={tab === "base" ? slots : [...CORE]}
            status={status}
            thumbs={thumbs}
          />
          <p className="estimate">{estimate}</p>

          <div className="prompt-actions">
            <button
              type="button"
              className="generate"
              disabled={busy}
              onClick={() =>
                void (tab === "base" ? generateBase() : generateCostume())
              }
            >
              {busy
                ? "Generating…"
                : tab === "base"
                  ? "Generate Base Sheet"
                  : "Generate costume sheet"}
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

function AngleProgress({
  slots,
  status,
  thumbs,
}: {
  slots: string[];
  status: Record<string, AngleStatus>;
  thumbs: Record<string, string>;
}) {
  return (
    <div className="sheet-progress">
      {slots.map((slot) => {
        const st = status[slot] || "idle";
        return (
          <div key={slot} className={`sheet-angle sheet-angle-${st}`}>
            {thumbs[slot] ? (
              <img src={thumbs[slot]} alt="" />
            ) : (
              <span className="sheet-angle-empty" />
            )}
            <span>
              {SLOT_LABEL[slot] || slot}
              {st === "run" ? "…" : st === "ok" ? " ✓" : st === "err" ? " !" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SceneBuilder({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (asset: StudioAsset) => void;
}) {
  const [name, setName] = useState("");
  const [setting, setSetting] = useState("interior");
  const [time, setTime] = useState("day");
  const [mood, setMood] = useState("calm");
  const [elements, setElements] = useState("");
  const [notes, setNotes] = useState("");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, AngleStatus>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const models = useSheetModels();
  const sceneSlots = sheet ? ["front", "side"] : ["front"];
  const estimate = useSheetEstimate("scene", models.t2iId, models.r2iId, sceneSlots);

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus({});
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
      if (!created.ok || !draft.item) {
        throw new Error(
          (typeof draft.detail === "string" ? draft.detail : null) || "Could not create scene.",
        );
      }
      const slots = sheet ? ["front", "side"] : ["front"];
      let last = draft.item;
      for (const slot of slots) {
        setStatus((cur) => ({ ...cur, [slot]: "run" }));
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: draft.item.id,
            slot,
            model_id: slot === "front" ? models.t2iId : models.r2iId || models.t2iId,
          }),
        });
        const body = await readJson<GenBody>(res);
        if (!res.ok || !body.item) {
          setStatus((cur) => ({ ...cur, [slot]: "err" }));
          throw new Error(
            (typeof body.detail === "string" ? body.detail : null) || `${slot} failed.`,
          );
        }
        last = body.item;
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        if (url) setThumbs((cur) => ({ ...cur, [slot]: `${url}&t=${Date.now()}` }));
        setStatus((cur) => ({ ...cur, [slot]: "ok" }));
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      toast(`Saved scene ${label}.`);
      onSaved(last);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scene generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="asset-creator-scrim" role="dialog" aria-label="Scene builder">
      <div className="asset-creator studio-node">
        <div className="node-header">
          <span>Scene builder</span>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <div className="node-body">
          <label className="builder-field">
            <span className="field-label">Name</span>
            <input
              className="model"
              value={name}
              placeholder="Classy bar"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="params">
            <label className="param">
              <span>Setting</span>
              <select
                className="model"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
              >
                {SETTINGS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="param">
              <span>Time</span>
              <select className="model" value={time} onChange={(e) => setTime(e.target.value)}>
                {TIMES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="param">
              <span>Mood</span>
              <select className="model" value={mood} onChange={(e) => setMood(e.target.value)}>
                {MOODS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="builder-field">
            <span className="field-label">Key elements</span>
            <input
              className="model"
              value={elements}
              placeholder="mahogany bar, neon sign, wet street"
              onChange={(e) => setElements(e.target.value)}
            />
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
                checked={sheet}
                onChange={(e) => setSheet(e.target.checked)}
              />{" "}
              Also generate a second angle (simple sheet)
            </span>
          </label>
          <label className="builder-field">
            <span className="field-label">Model</span>
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
          <AngleProgress slots={sheet ? ["front", "side"] : ["front"]} status={status} thumbs={thumbs} />
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
        </div>
      </div>
    </div>
  );
}

function PropBuilder({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (asset: StudioAsset) => void;
}) {
  const [name, setName] = useState("");
  const [ptype, setPtype] = useState("object");
  const [material, setMaterial] = useState("metal");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, AngleStatus>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const models = useSheetModels();
  const estimate = useSheetEstimate("prop", models.t2iId, models.r2iId, ["front"]);

  async function saveUpload() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("kind", "prop");
      fd.append("name", label);
      fd.append("notes", notes.trim());
      if (file) fd.append("files", file);
      const res = await fetch("/assets", { method: "POST", body: fd });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) {
        throw new Error(
          (typeof body.detail === "string" ? body.detail : null) || "Could not save prop.",
        );
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus({ front: "run" });
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
      if (!created.ok || !draft.item) {
        throw new Error(
          (typeof draft.detail === "string" ? draft.detail : null) || "Could not create prop.",
        );
      }
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
        setStatus({ front: "err" });
        throw new Error(
          (typeof body.detail === "string" ? body.detail : null) || "Generate failed.",
        );
      }
      const url = body.item.url || "";
      if (url) setThumbs({ front: `${url}?t=${Date.now()}` });
      setStatus({ front: "ok" });
      window.dispatchEvent(new Event("ams-assets-changed"));
      toast(`Saved prop ${label}.`);
      onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prop generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="asset-creator-scrim" role="dialog" aria-label="Prop builder">
      <div className="asset-creator studio-node">
        <div className="node-header">
          <span>Prop builder</span>
          <button type="button" className="ghost" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <div className="node-body">
          <label className="builder-field">
            <span className="field-label">Name</span>
            <input
              className="model"
              value={name}
              placeholder="Red mug"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="params">
            <label className="param">
              <span>Type</span>
              <select className="model" value={ptype} onChange={(e) => setPtype(e.target.value)}>
                {PROP_TYPES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="param">
              <span>Material</span>
              <select
                className="model"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                {MATERIALS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="builder-field">
            <span className="field-label">Color</span>
            <input
              className="model"
              value={color}
              placeholder="matte red"
              onChange={(e) => setColor(e.target.value)}
            />
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
          <div className="library-actions">
            <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
              {file ? file.name : "Upload still instead"}
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </div>
          <label className="builder-field">
            <span className="field-label">Model</span>
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
          <AngleProgress slots={["front"]} status={status} thumbs={thumbs} />
          <p className="estimate">{estimate}</p>
          <div className="prompt-actions">
            <button
              type="button"
              className="ghost"
              disabled={busy || !name.trim() || !file}
              onClick={() => void saveUpload()}
            >
              Save upload
            </button>
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
        </div>
      </div>
    </div>
  );
}
