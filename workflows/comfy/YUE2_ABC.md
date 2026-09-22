# YuE2 — where ABC lives in Comfy `/history`

**For Build.** After `POST /prompt`, poll `GET {COMFY_URL}/history/{prompt_id}`.
ABC is **not** a file on disk. It is UI/text output from `PreviewAny` nodes.

Canonical graphs: `workflows/comfy/YuE2 *.json` (API format).

---

## History shape (confirmed live)

```http
GET http://127.0.0.1:8188/history/{prompt_id}
```

```json
{
  "<prompt_id>": {
    "outputs": {
      "<node_id>": {
        "text": [ "<ABC string here>" ]
      }
    },
    "status": { "completed": true }
  }
}
```

- Key name is **`text`** (list of strings). Join with `\n` if length > 1; usually one element.
- `PreviewAny` is an output node (`RETURN` / `OUTPUT_NODE`); it receives a `STRING` and surfaces it under `outputs[id].text`.
- ACE’s `_history_files()` only walks audio file metas — **extend** (or add `_history_text`) for YuE2; do not expect ABC inside `audio` / `/view`.

Pseudo:

```python
def history_abc(hist: dict, node_ids: list[str]) -> str | None:
    outputs = hist.get("outputs") or {}
    for nid in node_ids:
        node_out = outputs.get(str(nid)) or {}
        texts = node_out.get("text")
        if isinstance(texts, list) and texts:
            return "\n".join(str(t) for t in texts if t is not None)
        if isinstance(texts, str) and texts.strip():
            return texts
    return None
```

Prefer the **first non-empty** match in the ordered list below.

---

## Node IDs by graph

### `YuE2 TEXT TO MUSIC GROK ROCK.json` (T2M)

| Node | class_type | What it is |
|------|------------|------------|
| **14** | `PreviewAny` ← `YuE2GenerateABC` (24) | Planned ABC |
| **52** | `PreviewAny` ← `YuE2GenerateABC` (24) | Same score that feeds Music. There is no paste switch on T2M |
| **109** | `SaveAudio*` | WAV only — not ABC |

**AIMS should return to the UI:**

1. Primary: **`outputs["52"].text[0]`** — score that fed Music (direct from node 24).
2. Optional / debug: **`outputs["14"].text[0]`** — the same planner ABC.

T2M has no pasted-ABC switch. 14 and 52 both preview Generate ABC. Edited scores go through Re-render from ABC.

### `YuE2 COVER.json`

| Node | class_type | What it is |
|------|------------|------------|
| **44** | `PreviewAny` ← `SheetSage2AudioToABC` (41) | Melody ABC from reference audio |
| **109** | `SaveAudio*` | WAV |

**Read:** `outputs["44"].text[0]`.

### `YuE2 RERENDER FROM ABC.json`

| Node | class_type | What it is |
|------|------------|------------|
| **52** | `PreviewAny` ← paste primitive (50) | Echo of pasted ABC |
| **109** | `SaveAudio*` | WAV |

**Read:** `outputs["52"].text[0]` (same string AIMS posted into node 50). Useful as a round-trip check; UI already has the paste.

---

## Audio vs ABC

| Artifact | Where |
|----------|--------|
| WAV/MP3 | `outputs["109"]` → list under `audio` / `wav` / etc. → `GET /view?filename=…` (same as ACE) |
| ABC text | `outputs["14"|"52"|"44"].text[0]` — **no** `/view` |

Save prefix examples: `AIMS_YuE2_T2M`, `AIMS_YuE2_Cover`, `AIMS_YuE2_Rerender`.

---

## AIMS return payload (suggested)

```json
{
  "ok": true,
  "path": ".../AIMS_YuE2_T2M_....wav",
  "abc": "<from history text>",
  "abc_source": "52",
  "cost_label": "Cost: $0.00"
}
```

Expose `abc` in the Music result UI (copy button → paste into T2M “Use pasted ABC” or Rerender).

---

## Pitfalls

1. **Empty `text`** — job still running, or PreviewAny not executed (bad link). Keep polling until `status.completed` **and** save-audio files exist; ABC may appear in the same `outputs` blob.
2. **Do not parse UI workflow JSON** for ABC — only `/history` after the run.
3. **Do not** patch style/lyrics onto T2M nodes 24/25 (those are links). Style/lyrics live on primitives **113** / **114** (`value`). See `BUILD_AIMS_YUE2.md`.
4. If a future graph renumbers PreviewAny nodes, update this file and `bindings.json` together. Prefer matching by `class_type == PreviewAny` + title if you add titles later; today IDs above are stable.

---

## Quick manual check

```powershell
# after a T2M run in Comfy:
$pid = "<prompt_id>"
(Invoke-RestMethod "http://127.0.0.1:8188/history/$pid").$pid.outputs.'52'.text[0].Substring(0,[Math]::Min(200, ...))
```

Expect ABC starting with something like `X:1` / meter / voice headers (SheetSage/YuE2 style), not a filepath.
