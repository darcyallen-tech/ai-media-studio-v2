import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { beginLibraryDrag, endLibraryDrag, peekLibraryDrag } from "./libraryDrag";
import { filesFromDataTransfer, importOsFiles } from "./osImport";
import { sendToResolve, toast } from "./toast";
import {
  writeLibraryPayload,
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
  const [dropHot, setDropHot] = useState(false);
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
    function onImported() {
      setSection("uploads");
      void reload();
    }
    window.addEventListener("ams-library-imported", onImported);
    const id = window.setInterval(() => {
      if (section === "resolve") void reload();
    }, 4000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("ams-library-imported", onImported);
    };
  }, [open, filter, section]);

  async function importFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    setBusy(true);
    try {
      await importOsFiles(files);
      setSection("uploads");
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      console.error("Library import failed", err);
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  function onDragStart(event: DragEvent, item: LibraryItem) {
    event.stopPropagation();
    beginLibraryDrag(item);
    writeLibraryPayload(event.dataTransfer, item);
  }

  function onDragEnd() {
    endLibraryDrag();
  }

  function onPanelDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (peekLibraryDrag()) return;
    event.dataTransfer.dropEffect = "copy";
    setDropHot(true);
  }

  function onPanelDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (peekLibraryDrag()) return;
    event.dataTransfer.dropEffect = "copy";
    setDropHot(true);
  }

  function onPanelDragLeave(event: DragEvent) {
    event.preventDefault();
    const next = event.relatedTarget as globalThis.Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setDropHot(false);
  }

  function onPanelDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setDropHot(false);
    if (peekLibraryDrag()) return;
    const files = filesFromDataTransfer(event.dataTransfer);
    if (files.length) void importFiles(files);
    else {
      console.error("Library drop had no files", [...event.dataTransfer.types]);
      toast("No files found in that drop.", true);
    }
  }

  const active = buckets[section];
  const items = useMemo(() => active?.items ?? [], [active]);

  if (!open) return null;

  return (
    <aside
      className={dropHot ? "library drop-hot" : "library"}
      ref={dropRef}
      data-os-drop="library"
      onDragEnter={onPanelDragEnter}
      onDragOver={onPanelDragOver}
      onDragLeave={onPanelDragLeave}
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
      <p className="hint">
        Click or drag onto a Source, Character, or Scene node. Drop OS files
        here to upload.
      </p>

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
              onDragEnd={onDragEnd}
              onClick={() => onPick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPick(item);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="library-thumb">
                {item.thumb_url ? (
                  <img src={item.thumb_url} alt="" draggable={false} />
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
