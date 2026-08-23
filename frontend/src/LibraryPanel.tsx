import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import AssetCreator from "./AssetCreator";
import AssetEditor from "./AssetEditor";
import { beginLibraryDrag, endLibraryDrag, peekLibraryDrag } from "./libraryDrag";
import { filesFromDataTransfer, importOsFiles } from "./osImport";
import { openLightbox } from "./lightbox";
import { sendToResolve, toast } from "./toast";
import { isAudioPath, isVideoPath } from "./media";
import {
  assetToLibraryItem,
  writeLibraryPayload,
  type AssetKind,
  type AssetRole,
  type LibraryBucket,
  type LibraryItem,
  type LibrarySource,
  type MediaKind,
  type StudioAsset,
} from "./types";

type Pane = "media" | "assets";
type AssetFilter = "all" | AssetKind;
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

const ASSET_TABS: { id: AssetFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "character", label: "Characters" },
  { id: "costume", label: "Costumes" },
  { id: "scene", label: "Scenes" },
  { id: "prop", label: "Props" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (item: LibraryItem) => void;
  onNewAsset?: (
    kind: AssetRole | "costume" | "dress",
    seeds?: { characterId?: string; costumeId?: string },
  ) => void;
};

export default function LibraryPanel({ open, onClose, onPick, onNewAsset }: Props) {
  const [pane, setPane] = useState<Pane>("media");
  const [filter, setFilter] = useState<Filter>("all");
  const [section, setSection] = useState<LibrarySource>("uploads");
  const [buckets, setBuckets] = useState<Record<string, LibraryBucket>>({});
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [creating, setCreating] = useState<AssetRole | null>(null);
  const [editing, setEditing] = useState<StudioAsset | null>(null);
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

  async function reloadAssets() {
    try {
      const res = await fetch("/assets");
      if (!res.ok) throw new Error(`Assets ${res.status}`);
      const body = (await res.json()) as { items?: StudioAsset[] };
      setAssets(body.items ?? []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load assets.");
    }
  }

  useEffect(() => {
    if (!open) return;
    void reload();
    void reloadAssets();
    function onImported() {
      setPane("media");
      setSection("uploads");
      void reload();
    }
    function onAssets() {
      void reloadAssets();
    }
    window.addEventListener("ams-library-imported", onImported);
    window.addEventListener("ams-assets-changed", onAssets);
    const id = window.setInterval(() => {
      if (pane === "media" && section === "resolve") void reload();
    }, 4000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("ams-library-imported", onImported);
      window.removeEventListener("ams-assets-changed", onAssets);
    };
  }, [open, filter, section, pane]);

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

  async function removeItem(item: LibraryItem) {
    if (!window.confirm(`Remove “${item.name}” from Library?`)) return;
    const resolve = (item.source || "").toLowerCase() === "resolve";
    let deleteFile = false;
    if (!resolve) {
      deleteFile = window.confirm(
        "Also delete the file from disk? Resolve inbox files are never deleted.",
      );
    }
    try {
      const qs = new URLSearchParams({ delete_file: deleteFile ? "true" : "false" });
      const res = await fetch(`/library/${encodeURIComponent(item.id)}?${qs}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { ok?: boolean; detail?: string; error?: string };
      if (!res.ok || body.ok === false) {
        throw new Error(body.detail || body.error || "Could not remove item.");
      }
      toast(deleteFile ? "Removed and deleted from disk." : "Removed from Library.");
      await reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Remove failed.";
      toast(msg, true);
    }
  }

  async function togglePin(item: LibraryItem) {
    try {
      const res = await fetch(`/library/${encodeURIComponent(item.id)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !item.pinned }),
      });
      const body = (await res.json()) as { ok?: boolean; detail?: string };
      if (!res.ok || body.ok === false) {
        throw new Error(body.detail || "Could not update pin.");
      }
      await reload();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Pin failed.", true);
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

  async function removeAsset(asset: StudioAsset) {
    if (!window.confirm(`Remove “${asset.name}” from Assets?`)) return;
    try {
      const res = await fetch(`/assets/${encodeURIComponent(asset.id)}`, {
        method: "DELETE",
      });
      const body = (await res.json()) as { ok?: boolean; detail?: string };
      if (!res.ok || body.ok === false) {
        throw new Error(body.detail || "Could not remove asset.");
      }
      window.dispatchEvent(new Event("ams-assets-changed"));
      toast("Removed from Assets.");
      await reloadAssets();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Remove failed.", true);
    }
  }

  function onAssetDragStart(event: DragEvent, asset: StudioAsset) {
    const item = assetToLibraryItem(asset);
    if (!item) {
      event.preventDefault();
      toast("This asset has no still yet.", true);
      return;
    }
    event.stopPropagation();
    beginLibraryDrag(item);
    writeLibraryPayload(event.dataTransfer, item);
  }

  function onPanelDragEnter(event: DragEvent) {
    if (pane !== "media") return;
    event.preventDefault();
    event.stopPropagation();
    if (peekLibraryDrag()) return;
    event.dataTransfer.dropEffect = "copy";
    setDropHot(true);
  }

  function onPanelDragOver(event: DragEvent) {
    if (pane !== "media") return;
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
    if (pane !== "media") return;
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
  const visibleAssets = useMemo(
    () =>
      assetFilter === "all"
        ? assets
        : assets.filter((a) => a.kind === assetFilter),
    [assets, assetFilter],
  );

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
        <button
          type="button"
          className={pane === "media" ? "pill mode on" : "pill mode"}
          onClick={() => setPane("media")}
        >
          Media
        </button>
        <button
          type="button"
          className={pane === "assets" ? "pill mode on" : "pill mode"}
          onClick={() => setPane("assets")}
        >
          Assets
        </button>
      </div>

      {pane === "media" ? (
        <>
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
              className={item.pinned ? "library-card pinned" : "library-card"}
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
              <button
                type="button"
                className="library-x nodrag"
                aria-label="Remove from Library"
                title="Remove from Library"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  void removeItem(item);
                }}
              >
                ×
              </button>
              <button
                type="button"
                className={item.pinned ? "library-pin on nodrag" : "library-pin nodrag"}
                aria-label={item.pinned ? "Unpin" : "Pin"}
                title={item.pinned ? "Unpin (allow auto-delete)" : "Pin (skip auto-delete)"}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  void togglePin(item);
                }}
              >
                {item.pinned ? "📌" : "📍"}
              </button>
              <div
                className="library-thumb"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const src = item.url || item.thumb_url;
                  if (!src) return;
                  const kind = isVideoPath(src)
                    ? "video"
                    : isAudioPath(src)
                      ? "audio"
                      : "image";
                  openLightbox({ src, kind, title: item.name });
                }}
              >
                {item.thumb_url ? (
                  <img src={item.thumb_url} alt="" draggable={false} />
                ) : (
                  <span>{item.kind}</span>
                )}
              </div>
              <span className="library-name">
                {item.pinned ? "📌 " : ""}
                {item.name}
              </span>
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
        </>
      ) : (
        <>
          <div className="pills chips">
            {ASSET_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={
                  assetFilter === tab.id ? "pill modality on" : "pill modality"
                }
                onClick={() => setAssetFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="library-actions">
            <button
              type="button"
              className="ghost"
              onClick={() =>
                onNewAsset ? onNewAsset("character") : setCreating("character")
              }
            >
              New Character
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                onNewAsset ? onNewAsset("costume") : setCreating("character")
              }
            >
              Costume Designer
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => onNewAsset?.("dress")}
            >
              Dress Character
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                onNewAsset ? onNewAsset("scene") : setCreating("scene")
              }
            >
              New Scene
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                onNewAsset ? onNewAsset("prop") : setCreating("prop")
              }
            >
              New Prop
            </button>
          </div>
          {error ? <p className="hint warn">{error}</p> : null}
          <p className="hint">
            Click a Character or Costume to view angles, set primary, and
            regenerate. Drag onto a matching node to attach.
          </p>
          <div className="library-grid">
            {visibleAssets.length === 0 ? (
              <p className="hint">No assets yet — New Character / Scene / Prop.</p>
            ) : (
              visibleAssets.map((asset) => {
                const item = assetToLibraryItem(asset);
                return (
                  <div
                    key={asset.id}
                    className={asset.parent_id ? "library-card is-variant" : "library-card"}
                    draggable={Boolean(item)}
                    title={asset.still_path || asset.name}
                    onDragStart={(e) => onAssetDragStart(e, asset)}
                    onDragEnd={onDragEnd}
                    onClick={() => {
                      if (asset.kind === "character" || asset.kind === "costume") {
                        setEditing(asset);
                        return;
                      }
                      if (item) onPick(item);
                      else toast("This asset has no still yet.", true);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <button
                      type="button"
                      className="library-x nodrag"
                      aria-label="Remove from Assets"
                      title="Remove from Assets"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        void removeAsset(asset);
                      }}
                    >
                      ×
                    </button>
                    <div
                      className="library-thumb"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const src = asset.thumb_url || asset.url;
                        if (!src) return;
                        openLightbox({
                          src,
                          kind: "image",
                          title: asset.label || asset.name,
                        });
                      }}
                    >
                      {asset.thumb_url || asset.url ? (
                        <img
                          src={asset.thumb_url || asset.url || ""}
                          alt=""
                          draggable={false}
                        />
                      ) : (
                        <span>{asset.kind}</span>
                      )}
                    </div>
                    <span className="library-name">{asset.label || asset.name}</span>
                    <span className="hint">
                      {asset.is_costume
                        ? "costume"
                        : asset.is_variant
                          ? "variant"
                          : asset.kind === "character" && asset.identity_urls
                            ? `character · ${Object.keys(asset.identity_urls).length} angles`
                            : asset.kind}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
      {creating ? (
        <AssetCreator
          kind={creating}
          onClose={() => setCreating(null)}
          onSaved={(asset) => {
            setCreating(null);
            void reloadAssets();
            const item = assetToLibraryItem(asset);
            if (item) onPick(item);
          }}
        />
      ) : null}
      {editing ? (
        <AssetEditor
          asset={editing}
          onClose={() => setEditing(null)}
          onChanged={(asset) => {
            setEditing(asset);
            void reloadAssets();
          }}
          onDress={(characterId) => {
            setEditing(null);
            onNewAsset?.("dress", { characterId });
          }}
          onUseRef={(asset) => {
            const item = assetToLibraryItem(asset);
            setEditing(null);
            if (item) onPick(item);
            else toast("This asset has no still yet.", true);
          }}
          onSheetOpened={() => {
            setEditing(null);
            onClose();
          }}
        />
      ) : null}
    </aside>
  );
}
