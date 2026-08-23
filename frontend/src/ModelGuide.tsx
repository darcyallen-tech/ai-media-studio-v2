import { useEffect, useMemo, useRef, useState } from "react";

const ALL = "all";
const LS_SECTION = "ams-v2-model-guide-section";

type GuideModel = {
  id: string;
  label: string;
  modalities?: string[];
  tagline?: string;
  strengths?: string[];
  weaknesses?: string[];
  use_cases?: string[];
};

type GuideSection = {
  id: string;
  label: string;
  blurb?: string;
  models: GuideModel[];
};

type GuideDoc = {
  title?: string;
  version?: string;
  updated?: string;
  note?: string;
  sections: GuideSection[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function readStoredSection(): string {
  try {
    return localStorage.getItem(LS_SECTION) || "t2i";
  } catch {
    return "t2i";
  }
}

function writeStoredSection(id: string) {
  try {
    localStorage.setItem(LS_SECTION, id);
  } catch {
    /* ignore quota / private mode */
  }
}

function haystack(model: GuideModel): string {
  return [
    model.label,
    model.id,
    model.tagline,
    ...(model.modalities || []),
    ...(model.strengths || []),
    ...(model.weaknesses || []),
    ...(model.use_cases || []),
  ]
    .join(" ")
    .toLowerCase();
}

export default function ModelGuide({ open, onClose }: Props) {
  const [doc, setDoc] = useState<GuideDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sectionId, setSectionId] = useState<string>(readStoredSection);
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const ac = new AbortController();
    void fetch("/model-guide.json", { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Guide ${res.status}`);
        return (await res.json()) as GuideDoc;
      })
      .then((body) => {
        const sections = Array.isArray(body.sections) ? body.sections : [];
        setDoc({ ...body, sections });
        const ids = sections.map((s) => s.id);
        setSectionId((cur) => {
          if (cur === ALL || ids.includes(cur)) return cur;
          return ids[0] || ALL;
        });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load guide.");
      });
    return () => ac.abort();
  }, [open]);

  useEffect(() => {
    writeStoredSection(sectionId);
  }, [sectionId]);

  useEffect(() => {
    paneRef.current?.scrollTo(0, 0);
  }, [sectionId, query]);

  const sections = doc?.sections ?? [];
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    const src =
      sectionId === ALL
        ? sections
        : sections.filter((s) => s.id === sectionId);
    if (!q) return src;
    return src
      .map((s) => ({
        ...s,
        models: (s.models || []).filter((m) => haystack(m).includes(q)),
      }))
      .filter((s) => s.models.length > 0);
  }, [sections, sectionId, q]);

  const modelCount = visible.reduce((n, s) => n + s.models.length, 0);
  const active = sections.find((s) => s.id === sectionId);

  if (!open) return null;

  return (
    <aside className="settings model-guide" role="dialog" aria-label="Model Guide">
      <header className="library-head">
        <h2>Model Guide</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="guide-body">
        <nav className="guide-rail" aria-label="Guide categories">
          <button
            type="button"
            className={sectionId === ALL ? "guide-rail-btn on" : "guide-rail-btn"}
            aria-current={sectionId === ALL ? "true" : undefined}
            onClick={() => setSectionId(ALL)}
          >
            All
            <span>{sections.reduce((n, s) => n + (s.models?.length || 0), 0)}</span>
          </button>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={sectionId === s.id ? "guide-rail-btn on" : "guide-rail-btn"}
              aria-current={sectionId === s.id ? "true" : undefined}
              onClick={() => setSectionId(s.id)}
            >
              {s.label}
              <span>{s.models?.length || 0}</span>
            </button>
          ))}
        </nav>

        <div className="guide-pane">
          <div className="guide-pane-head">
            <input
              className="model"
              type="search"
              value={query}
              placeholder={
                sectionId === ALL
                  ? "Search all models, taglines, ids…"
                  : "Search this category…"
              }
              aria-label="Search models"
              onChange={(e) => setQuery(e.target.value)}
            />
            <p className="hint">
              {sectionId === ALL
                ? `All categories · ${modelCount} model${modelCount === 1 ? "" : "s"}`
                : `${active?.label || "Category"} · ${modelCount} model${modelCount === 1 ? "" : "s"}`}
              {doc?.updated ? ` · ${doc.updated}` : ""}
            </p>
            {sectionId !== ALL && active?.blurb ? (
              <p className="hint">{active.blurb}</p>
            ) : null}
            {error ? <p className="hint warn">{error}</p> : null}
          </div>

          <div className="guide-cards" ref={paneRef}>
            {!doc && !error ? <p className="hint">Loading…</p> : null}
            {doc && visible.length === 0 && !error ? (
              <p className="hint">
                {q ? "No models match that search." : "No models in this category."}
              </p>
            ) : null}
            {visible.map((section) => (
              <section key={section.id} className="guide-section">
                {sectionId === ALL ? (
                  <div className="guide-sec-head">
                    <h3>{section.label}</h3>
                    {section.blurb ? <p className="hint">{section.blurb}</p> : null}
                  </div>
                ) : null}
                {section.models.map((model) => (
                  <article key={`${section.id}:${model.id}`} className="guide-card">
                    <header>
                      <div>
                        <h3>{model.label}</h3>
                        {model.tagline ? (
                          <p className="guide-tagline">{model.tagline}</p>
                        ) : null}
                      </div>
                      <div className="guide-mods">
                        {(model.modalities || []).map((mod) => (
                          <em key={mod} className="guide-mod">
                            {mod.toUpperCase()}
                          </em>
                        ))}
                      </div>
                    </header>
                    <p className="guide-id">{model.id}</p>
                    <div className="guide-cols">
                      <GuideCol title="Strengths" items={model.strengths} />
                      <GuideCol title="Watch-outs" items={model.weaknesses} />
                      <GuideCol title="Use for" items={model.use_cases} />
                    </div>
                  </article>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function GuideCol({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
