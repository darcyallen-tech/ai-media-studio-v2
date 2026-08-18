import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { sendToResolve } from "./toast";
import {
  LIBRARY_DRAG_MIME,
  type LibraryBucket,
  type LibraryItem,
  type LibrarySource,
  type MediaKind,
} from "./types";

type Filter = "all" | MediaKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
];

const SECTIONS: { id: LibrarySource; label: string }[] = [
  { id: "resolve", label: "From Resolve" },
  { id: "uploads", label: "Uploads" },
  { id: "generated", label: "Generated" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (item: LibraryItem) => void;
};

export default function LibraryPanel({ open, onClose, onPick }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [section, setSection] = useState<LibrarySource>("uploads");
  const [buckets, setBuckets] = useState<Record<string, LibraryBucket>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLElement>(null);

  async function reload() {
    try {
      const qs = filter === "all" ? "" : `?type=${filter}`;
      const res = await fetch(`/library${qs}`);
      if (!res.ok) throw new Error(`Library ${res.status}`);
      const body = (await res.json()) as {
        resolve?: LibraryBucket;
        uploads?: LibraryBucket;
        generated?: LibraryBucket;
      };
      setBuckets({
        resolve: body.resolve ?? { source: "resolve", items: [] },
        uploads: body.uploads ?? { source: "uploads", items: [] },
        generated: body.generated ?? { source: "generated", items: [] },
      });
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load library.");
    }
  }

  useEffect(() => {
    if (!open) return;
    void reload();
    const id = window.setInterval(() => {
      if (section === "resolve") void reload();
    }, 4000);
    return () => window.clearInterval(id);
  }, [open, filter, section]);

  async function importFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const file of files) form.append("files", file);
      const res = await fetch("/library/import", { method: "POST", body: form });
      const body = (await res.json()) as { errors?: string[] };
      if (!res.ok) throw new Error((body as { detail?: string }).detail || "Import failed");
      if (body.errors?.length) setError(body.errors.join(" · "));
      setSection("uploads");
      await reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function onDragStart(event: DragEvent, item: LibraryItem) {
    event.dataTransfer.setData(LIBRARY_DRAG_MIME, JSON.stringify(item));
    event.dataTransfer.effectAllowed = "copy";
  }

  function onPanelDragOver(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onPanelDrop(event: DragEvent) {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files);
  }

  const active = buckets[section];
  const items = useMemo(() => active?.items ?? [], [active]);

  if (!open) return null;

  return (
    <aside
      className="library"
      ref={dropRef}
      onDragOver={onPanelDragOver}
      onDrop={onPanelDrop}
    >
      <header className="library-head">
        <h2>Library</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="pills chips">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={section === s.id ? "pill modality on" : "pill modality"}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="pills">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "pill mode on" : "pill mode"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="library-actions">
        {section === "resolve" ? (
          <button type="button" className="ghost" onClick={() => void reload()}>
            Refresh From Resolve
          </button>
        ) : null}
        <button
          type="button"
          className="ghost"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "Importing…" : "Import files…"}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept="image/*,video/*,audio/*"
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? <p className="hint warn">{error}</p> : null}
      {active?.note ? <p className="hint">{active.note}</p> : null}
      <p className="hint">Click or drag onto a Source node. Drop OS files here to upload.</p>

      <div className="library-grid">
        {items.length === 0 ? (
          <p className="hint">Nothing here yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="library-card"
              draggable
              title={item.path}
              onDragStart={(e) => onDragStart(e, item)}
              onClick={() => onPick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPick(item);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="library-thumb">
                {item.thumb_url ? (
                  <img src={item.thumb_url} alt="" />
                ) : (
                  <span>{item.kind}</span>
                )}
              </div>
              <span className="library-name">{item.name}</span>
              <button
                type="button"
                className="ghost library-send"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  void sendToResolve(item.path, { type: item.kind });
                }}
              >
                Send to Resolve
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
