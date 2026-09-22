# BUILD → AIMS: YuE2 (start here)

Hand this file to **Grok Build / Cursor Build** as the implementation brief.
Owner: Darcy (AI Media Studio V2). PC: RTX 5070 Ti ~16 GB. Comfy at `http://127.0.0.1:8188`.

**Scope for this pass:** wire **YuE2 local Comfy music** into AIMS Audio → Music, mirroring ACE-Step.
Do **not** start Qwen / T2V / other bindings until YuE2 ships and smoke-tests.

---

## Goal

Expose three local Comfy music modes in AIMS (cost `$0.00`), same Settings `COMFY_URL` as ACE-Step:

| AIMS key | Graph file (API format) | User-facing label |
|----------|-------------------------|-------------------|
| `yue2_t2m` | `YuE2 TEXT TO MUSIC GROK ROCK.json` | YuE2 Text-to-Music (ABC + paste re-render) |
| `yue2_cover` | `YuE2 COVER.json` | YuE2 Cover (SheetSage2 melody) |
| `yue2_rerender_abc` | `YuE2 RERENDER FROM ABC.json` | YuE2 Re-render from ABC |

Canonical graphs live in:

`C:\Users\Darcy\ai-media-studio-v2\workflows\comfy\`

Also see `YUE2_WORKFLOWS.md` and `YUE2_GROK_ROCK.md` in that folder.

---

## Pattern to copy (do not invent a new stack)

Local music already works for ACE-Step:

| Piece | Path |
|-------|------|
| Registry | `backend/app/audio_registry.py` → `MUSIC_MODELS` entry `ace step 1.5`, endpoint `comfy:ace-step-1.5` |
| Runner | `backend/app/comfy_ace.py` (`generate_ace_step`, probe `/system_stats`, queue `/prompt`, poll history, copy audio out) |
| Dispatch | `backend/app/audio_service.py` — if `is_ace_step(spec)` → `generate_ace_step(...)` |
| Workflow JSON | `backend/app/workflows/audio_ace_step_1_5_split.json` |
| UI | `frontend/src/PromptNode.tsx` — `isAce` extras (lyrics, comfy_url, seed, steps, …) |

**Implement YuE2 the same way:** new `comfy_yue2.py` (or shared `comfy_music.py` helper + thin wrappers). Reuse URL normalize / health / queue / poll / save from ACE — do not duplicate HTTP glue carelessly; extract only if clean.

---

## Critical: fix `bindings.json` before coding patches

`workflows/comfy/bindings.json` keys `yue2_t2m` (alias `yue2_grok_rock`) / `yue2_cover` / `yue2_rerender_abc`. T2M style/lyrics bind to nodes **113** / **114**.

Live T2M graph (`YuE2 TEXT TO MUSIC GROK ROCK.json`):

- Style + lyrics are **PrimitiveStringMultiline** nodes **113** / **114** (`value`), linked into ABC + Music.
- Nodes **24** / **25** take style/lyrics as **links** — do **not** patch `24.style` / `25.style` (that would smash the link).
- Music.abc is a direct link from Generate ABC node **24**. No paste switch on this graph. Pasted scores use Re-render from ABC.
- Checkpoint node **15**: `yue2_3b_bf16.safetensors`
- Sampler **8**; Save **109** (`SaveAudio` / `SaveAudioWAV`-style — keep prefix `AIMS_YuE2_*`)

### Correct binding targets (verify against JSON before merge)

**`yue2_t2m`** ← rename from `yue2_grok_rock` or keep alias:

| Binding | Node | Field |
|---------|------|-------|
| `style` | `113` | `value` |
| `lyrics` | `114` | `value` |
| `mode` | `25` and `24` | `mode` (`full` or `melody` on both) |
| `max_duration` | `25` | `max_duration` only. Node 5 `seconds` stays link `["25", 1]` |
| `seed_abc` | `24` | `seed` |
| `seed_music` | `25` | `seed` |
| `seed_sampler` | `8` | `seed` |
| `steps` | `8` | `steps` |

Do not write the request duration into node 5 `seconds`. That input stays the Music output 1 link.

**`yue2_cover`:**

| Binding | Node | Field |
|---------|------|-------|
| `audio` | `45` | `audio` (filename after Comfy `/upload/image` or audio upload — use whatever ACE/Comfy path AIMS already uses for LoadAudio) |
| `style` | `25` | `style` (inline scalar on this graph) |
| `lyrics` | `25` | `lyrics` |
| `sheetsage_mode` | `41` | `mode` (default `melody`) |
| `music_mode` | `25` | `mode` (default `melody`) |
| `max_duration` | `25` | `max_duration` |
| `seed_music` / `seed_sampler` | `25` / `8` | `seed` |

Encoder: `sheetsage2_bf16.safetensors` via node **43**.

**`yue2_rerender_abc`:**

| Binding | Node | Field |
|---------|------|-------|
| `abc` | `50` | `value` |
| `style` / `lyrics` | `25` | scalars |
| `mode` / `max_duration` / seeds | as above | |

Update `docs/COMFY_BINDINGS.md` with a YuE2 section after wiring.

---

## Backend checklist

1. **Copy or load** the three API JSONs into `backend/app/workflows/` (same as ACE) **or** resolve from `workflows/comfy/` via `PROJECT_ROOT` — prefer one clear path; document it.
2. Add `MUSIC_MODELS` entries, e.g.:
   - `yue2 text to music` → endpoint `comfy:yue2-t2m`
   - `yue2 cover` → `comfy:yue2-cover`
   - `yue2 rerender abc` → `comfy:yue2-rerender`
   - `cost_estimate_usd=0.0`, notes: Settings COMFY_URL only; ~8 GB VRAM peak in Darcy’s tests; bf16 OK on 16 GB.
3. `is_yue2(spec)` + `generate_yue2(...)` branched from `audio_service.py` beside ACE.
4. Patch helpers:
   - Deep-copy graph → set binding fields → queue → poll (YuE2 can run **several minutes**; raise poll timeout vs ACE — suggest **15–20 min**).
   - Prefer **WAV** output (Darcy preference for local music).
5. Cover: upload reference audio into Comfy input, set LoadAudio `audio` to uploaded name.
6. Return ABC text when available (T2M PreviewAny / history) so UI can show “copy ABC → paste re-render”. If history does not expose PreviewAny cleanly, at minimum return the WAV + status; ABC in UI can be phase 1.1.
7. Do **not** call fal for these endpoints. Cost label always `$0.00`.
8. License note in UI/help: YuE2 weights **CC-BY-NC** (personal/testing OK; not for selling tracks as-is).

---

## Frontend checklist (`PromptNode.tsx` + music UI)

When model matches `/yue2/i`:

**All modes**

- Style (multiline) — maps to binding `style`
- Lyrics (multiline) — maps to `lyrics`
- Max duration (seconds) — default T2M **240–300**; Cover/Rerender **120**
- Seeds: music + sampler (and ABC seed on T2M); randomize toggles OK
- Optional: steps (default **32**), leave cfg **1**, sampler **dpm_2**, scheduler **sgm_uniform** unless advanced panel
- Comfy URL field (reuse ACE’s)

**T2M extras**

- Mode `full` | `melody` (default `full`) written to Generate ABC and Generate Music
- Pasted scores go to Re-render from ABC, not this graph

**Cover extras**

- Reference audio picker / upload → `audio`
- Default SheetSage + music mode **melody**

**Rerender**

- Required ABC textarea → `abc`
- No ABC generator

Music model dropdown: list YuE2 under local Comfy (near ACE-Step). Est. cost `$0.00`.

---

## Models / Comfy prerequisites (do not download in Build unless asked)

Already on Darcy’s machine when graphs were tested:

- Checkpoint: `yue2_3b_bf16.safetensors` (INT8 convrot only if OOM)
- Cover: `sheetsage2_bf16.safetensors` under audio encoders
- Custom nodes for YuE2 + SheetSage2 must be installed in Comfy (same env that already ran these graphs)

Build should **fail clearly** if Comfy is down or nodes missing (reuse ACE’s “set COMFY_URL :8188” messaging).

---


## ABC from `/history` (required for paste re-render UX)

See **[YUE2_ABC.md](./YUE2_ABC.md)**. Short version: after poll, read `outputs[\"52\"].text[0]` on T2M (ABC that fed Music); Cover uses `outputs[\"44\"].text[0]`. Not a file — do not use `/view`.
## Acceptance tests

1. Settings Comfy Connected → pick **YuE2 Text-to-Music** → short style + lyrics → Generate → WAV in Library / outputs, status mentions local Comfy, `$0.00`.
2. Same job: copy ABC (or paste a known ABC) → enable Use pasted ABC → Generate → finishes without full re-plan (faster / different seed path).
3. **Cover**: upload a short reference clip + new style/lyrics → WAV.
4. **Rerender**: paste ABC only → WAV.
5. Comfy stopped → clear error (not a fal fallback).
6. ACE-Step still works unchanged.

---

## Out of scope (this Build)

- Qwen Image 2.1 AIMS lanes (graphs already in `workflows/comfy/`; separate brief later)
- SFX Desk / Resolve
- Changing fal MiniMax / ElevenLabs music
- Marketing copy / installer rebuild unless required to ship the feature

---

## How Darcy will run this

Open the AIMS repo in Cursor → feed Build this file → ask for YuE2 Music wiring only → review PR/diff → smoke on Comfy :8188.

If something in the live JSON disagrees with this doc, **trust the JSON** and update bindings + this file.

## Related Build docs

- Prompt Builder Apply / Enhance lyrics split: `../../YuE2-Prompt-Builder-Apply-Contract.md` (Prompty + Alfred, 2026-09-21)

- **YuE2 Comfy fail / stuck Generating:** `../../docs/BUILD_YuE2_Comfy_Fail_Stuck_UI.md`

- **YuE2 T2M duration wiring (keep latent link):** `../../docs/BUILD_YuE2_T2M_Duration_Wiring.md`
