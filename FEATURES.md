# AI Media Studio V2 — Features

**Version:** 2.0.0-rc4 (Windows)

Free desktop app. You bring your own API keys. You pay the providers for what you generate — not a subscription to this app.

Catalog below is from the live app (`GET /models`, `GET /tools`) on 27 Aug 2026. Names match the in-app dropdowns. Older sibling SKUs stay callable for existing jobs (endpoints kept) but are hidden from dropdowns and the Model Guide current lists.

---

## Overview

AI Media Studio V2 is a **node canvas** for stills, video, audio, and a clip Frame Editor. You drop sources from the Library, pick a model, generate, and send results back to the Library or DaVinci Resolve.

**Windows package.** Double-click `AIMediaStudioV2.exe` (or `AMS_V2.bat`). A native window opens. Data lives under `%LOCALAPPDATA%\AI Media Studio V2\` (outputs, library, secrets, spend). Nothing is written into Program Files.

**Bring your own keys** (Settings):

| Key | Required for |
|-----|----------------|
| **fal** (`FAL_KEY`) | Almost all image, video, audio, and Tools |
| **xAI** (optional) | Prompt Enhance / Grok text. Grok Imagine models still run through fal. |
| **Runware** (optional) | **Frame Editor only** (Aleph 2.0). Not a second image/video catalog. |

Without a fal key, Create and Tools stay blocked. Without Runware, Frame Editor stays blocked. The rest of the app still opens.

---

## Compare + Mask

**Compare Source** on still Results opens a COMPARE node: source under the result, opacity, overlay toggle, swap. Enabled when the generate job had a source still. On T2I the button is visible but disabled (“No source image on this job.”).

**Mask node.** On I2I (and R2I with exactly one image), **Add Mask** appears when the model supports it (Fibo Edit 1.5). Boxes + brush. White = edit, black = keep. Same pixel size as the source. Extra refs on Fibo 1.5 disable mask. Muse Image Edit has no mask. The Image Region subtab is gone; drop-a-still is no longer the primary mask UI. Seedream 5 Pro edit stays in the I2I model list.

JPEG convert (Library / partner re-upload) does not lock the UI.

---

## Create

Each mode is a Prompt node plus slots (source still, last frame, refs, elements). Duration, aspect, resolution, and native audio on/off appear when the model supports them. Advanced (when shown): seed, negative prompt, image count, FLUX 3 draft.

Cost is estimated before you generate.

### Image

| Path | What it does | Models in catalog |
|------|----------------|-------------------|
| **T2I** | Text to a still | Flux 2 Pro, Flux 2 (cheaper), Flux 2 Flex, Recraft V4, Qwen Image 3, Nano Banana 2 (fast), Nano Banana Pro, Seedream 5.0 Lite, Seedream 5.0 Pro, Grok Imagine Image 2.0, **Fibo Gen 1.5**, **Muse Image** (~$0.01, instruction + typography) |
| **I2I** | Edit one still | Flux 2 Pro / Max / Flex, MAI-Image-2.5 Pro / 2.5, Nano Banana Pro / 2, Flux Kontext Pro, Grok Imagine 2.0 Edit, Qwen Image 3, Seedream 5.0 Pro (boxed edits via **Add Mask**), **Fibo Edit 1.5** (multi-ref, optional mask on single-ref), **Muse Image Edit** (precise instruction, no mask, up to 10 stills) |
| **R2I** | Edit from extra reference stills | Flux 2 Pro / Max / Flex, Nano Banana Pro / 2, Grok Imagine 2.0 Edit, Qwen Image 3, Seedream 5 Pro R2I, **Fibo Edit 1.5** (up to 4 images, `<image_1>`… tags), **Muse Image Edit** (up to 10 stills) |

Default image model: Flux 2 Pro (edit). For listing staging / furniture pop-in, **Fibo Edit 1.5** is a strong default (~$0.04, licensed, optional Mask). **Muse Image Edit** is a strong cheap furniture test (~$0.01, no mask). Flux 2 Pro / Nano Banana Pro remain in the list.

**Muse Image** (`meta/muse-image/text-to-image` + `meta/muse-image/edit`): Partner commercial. Edit is I2I/R2I, no `mask_url`. Aspect **Match source** omits `aspect_ratio` so the output follows the still — do not default I2I to 9:16. Partner fetch cannot use stale `v3b.fal.media` URLs; the app falls back to a data-URI / JPEG-WebP re-upload on `file_download_error`.

### Video

| Path | What it does | Models in catalog |
|------|----------------|-------------------|
| **T2V** | Text to a clip | Veo 3.1 / Fast, Luma Ray 3.2, MiniMax H3, **MiniMax H3 Max**, Grok Imagine 1.5, FLUX 3 (draft available), Seedance 2.5, **Wan 3.0** (up to 30s @ 1080p, native audio), LTX 2.5 Pro / Fast, Kling 3.0 Pro / Standard (native multi-shot), Kling O3 Pro / Standard, Mirage Avatar X, **Gemini Omni Flash 1.1** |
| **I2V** | Animate a start still (optional last frame on flagged models) | Grok Imagine 1.5, Kling O3 Standard / Pro, Kling 3.0 Standard / Pro (elements + multi-shot + last frame), Seedance 2.5 (last frame), **Wan 3.0** (last frame, 30s @ 1080p), FLUX 3 I2V (draft), FLUX 3 First→Last, MiniMax H3, **MiniMax H3 Max**, Veo 3.1 Fast / 3.1, LTX 2.5 Pro / Fast, **Gemini Omni Flash 1.1** |
| **R2V** | Refs (stills, and on some models video/audio) | MiniMax H3 Omni (default), **H3 Max R2V**, Seedance 2.5, **Wan 3.0** (10 image refs + video/audio, cite Image 1 / Image 2), Grok Imagine 1.5, Veo 3.1 reference pack, FLUX 3 identity ref (draft), Mirage Avatar X, **Gemini Omni Flash 1.1** (cite `<IMAGE_REF_0>` / `<VIDEO_REF_0>`) |
| **V2V** | Edit or retake an existing clip | Kling O3 Standard / Pro edit (elements), **Kling O3 4K Edit**, **Kling O3 4K Reference**, LTX 2.3 Retake, Grok Imagine Edit Video, FLUX 3 Extend (draft), sync-3 lipsync (needs dialogue audio; prompt unused), **Gemini Omni Flash 1.1 Edit** (NL prompt + source clip) |
| **Bridge** | First still → last still | Veo 3.1 Fast / 3.1, Kling O3 Pro / Standard, FLUX 3, Seedance 2.5, MiniMax H3, Wan 3.0 (I2V last frame) |
| **Extend** | Continue a clip | FLUX 3 Extend |

Default video model: Kling O3 Standard V2V edit.

**Listing-oriented notes (not a ranking):**

- Last-frame I2V is on Kling 3.0, Kling O3, Seedance 2.5, MiniMax H3 / H3 Max, LTX 2.5, Wan 3.0, Gemini Omni Flash 1.1, and the dedicated Bridge / First→Last rows.
- **MiniMax H3 Max** sits beside H3 (does not replace it). T2V + I2V. 5–15s · 480P/768P. Launch promo ~$0.025/s @480P · ~$0.04/s @768P until 1 Sep 2026; catalog after that $0.05 / $0.08.
- **H3 Max R2V** (`minimax/h3-max/reference-to-video`) is a separate cheaper Max stack for multi-ref characters/scenes (Image 1 / Video 1 / Audio 1). Est. $0.08/s output; extra refs after 4096 included tokens. Not an alias of H3 Max I2V.
- **H3 Max Turbo** (`minimax/h3-max-turbo`) T2V + I2V (Bridge via `end_image_url`). Cheap scout, 768p cap. Does not replace H3 Max or H3 R2V.
- **Kling O3 4K Edit** — NL edit of a real clip, native 4K, listing-grade, spendy ($0.42/s). Source mp4/mov 3–15s, max 200MB.
- **Kling O3 4K Reference** — keep camera/motion from the clip, swap subject/look with @ElementN / @ImageN, native 4K ($0.42/s).
- **Gemini Omni Flash 1.1** T2V / I2V / R2V / V2V edit. V2V is NL video edit (prompt + source clip; no first/last frame). R2V cites `<IMAGE_REF_0>` / `<VIDEO_REF_0>`. Est. $0.03/s @360p · $0.10/s @720p · $0.15/s @1080p · $0.30/s @4k.
- **Wan 3.0** (T2V / I2V / R2V): up to 30s @ 1080p, native audio, cost scales with seconds × resolution. R2V locks character/scene from up to 10 stills (cite Image 1 / Image 2 in the prompt).
- Kling 3.0 I2V can lock characters with **Elements** (`@Element1` …) and cut a board with **native multi-shot**.
- FLUX 3 can run a cheap **draft**, then Enhance to full quality on the same motion.
- Seedance 2.5 can refuse some photoreal faces. Prefer I2V (start / last frame) over R2V for synthetic people. There is no safety-off switch.
- Enhance will not send a job a model is known to refuse; it will rewrite or offer a switch. Generate does the same for hard pairs (Seedance I2V/R2V + photoreal face still; Veo / Gemini Omni video + real name or likeness; Kling + real guns / PRC politics; Hailuo / Ideogram + election campaign). It does not auto-switch. Photoreal checkbox is a style lock, not a Fal flag. Creative Enhance embellishes content; it is not a policy bypass.

### Audio

| Kind | Models |
|------|--------|
| **Music** | MiniMax Music 3 (default), Sonilo v1.1, ElevenLabs Music, Google Lyria 3 Pro, Stable Audio 2.5 |
| **SFX** | ElevenLabs Sound Effects V2, Sonilo Text-to-SFX |
| **Voiceover** | MiniMax Speech 2.8 HD, MiniMax Speech 2.6 HD, Grok TTS, ElevenLabs Eleven v3, ElevenLabs Turbo v2.5 |

Instrumental is a toggle on music models that support it. Voice is a dropdown on TTS models that ship a voice list.

---

## Catalog hide (rc4)

Dropdowns hide older siblings. Endpoints stay callable for existing jobs:

Flux 1.1 Pro Ultra, Seedream 4.5, Fibo Edit v1, Kling 2.5 / 2.6, Grok Imagine v1 Edit / Quality Edit, MiniMax Music 2.6, Lyria 2, Luma Ray 2, MiniMax Speech 02 HD.

Still visible: **Flux Kontext Pro**, **LTX 2.3 Retake**, **Fibo Edit 1.5**, **Aleph 2.0**.

---

## Frame Editor (Aleph 2.0 / Runware)

Optional. Needs a **Runware** key. One catalog row: **Aleph 2.0 (Runware)**.

- Drop a source clip (about 2–30 s; longer clips are prepared and trimmed).
- Pin up to **5** frames, edit a pin (still edit), apply it back, then render.
- Output length follows the source (2–30 s).
- Not on fal. Fal video models do not replace this path.

---

## Storyboard

A Hub + Shot nodes, then one generate.

- **Asset Hub:** characters, scenes, props, and **Add Costume** (Assets → costumes, edge labeled Costume so shots do not treat it as a second character). Drag-from-Library still works.
- **Shots:** action / camera, duration budget, start stills.
- Default model: **MiniMax H3 Omni** (reference-to-video).
- Also in the storyboard list: Seedance 2.5 R2V, Grok Imagine 1.5 R2V, Veo 3.1 reference, FLUX 3 identity R2V, Mirage Avatar X, **Kling 3.0** Standard/Pro I2V and T2V.

When the model supports it (Kling 3.0):

- Shots go out as native **`multi_prompt`** (customize or intelligent cuts), not one flattened paragraph.
- **Elements** tray on Kling 3.0 I2V (`@ElementN`). Hidden on Kling T2V.

Other storyboard models still flatten the board into one R2V prompt plus hub/shot refs. Last frame is not sent from Storyboard (use Video I2V / Bridge for that). Grok Imagine 1.5 R2V prompt cap is 4096 (blocked before POST; Enhance compact fits Image N + one line/shot); H3 / R2V refs downscale to 1920 JPEG on the Storyboard upload path.

---

## Tools

Same canvas, a Tool node. Fal-backed. Image and video as listed.

| Category | Image | Video |
|----------|-------|-------|
| **Upscale** | Topaz Upscale, SeedVR, Recraft Crisp, Topaz Wonder 3.5 | SeedVR2, Bytedance, Topaz Proteus / Artemis HQ / Nyx / Starlight HQ / Gaia HQ / Starlight Precise 2.6, RealESRGAN, FLUX Video Upscale |
| **Denoise** | Nyx / Nyx Fast / XL / HF, Artemis HQ / MQ / LQ | same Topaz family |
| **Restore** | Topaz Recovery V2, CodeFormer, NAFNet Deblur, Nano Banana 2 / Flux Kontext Pro / Grok Imagine Edit (prompt restore) | Kling O3 Standard / Pro V2V, Grok Imagine Edit Video |
| **Deblur** | NAFNet Deblur | Topaz Artemis HQ, Proteus |
| **Interpolate** | — | RIFE (fast), FILM (large motion) |

Interpolate is video-only. Changing duration / factor re-estimates cost.

---

## Library + Assets

**Library** (side panel): generated files, uploads, and **From Resolve** when an inbox folder is set. Drag a still or clip onto a Source, Last Frame, Tool, or pin. **Send to Resolve** is on the Library row and on Result nodes.

**Assets:** characters, scenes, props (costumes API is there for sheets). Hub on Storyboard reads these. You can attach stills and reuse them as refs or Kling elements. Character angles/sheets clear generating on success; Flux edit uses auto; Seedream/Qwen send real image sizes. R2I ref caps match fal product pages: Nano Banana Pro edit 14, Flux 2 Pro 9, Flex 10, Max 8, Muse/Seedream 10, Nano Banana 2 4, Qwen 3. Character extra-angle Result nodes (Side, Back, ¾, Top) default to Qwen Image 3 when it is in the R2I list; Front stays the T2I pick; sheet compose stays Muse/Nano Pro edit; top-down is overhead above the crown (subject does not look up). Character Sheet compose: full-body head-to-toe panels (close-up/top-down the only crops); pick which angle stills to send; Enhance rewrites the sheet prompt using selected slot names. Flux 2 Pro/Max/Flex edit on sheet is Auto-only (no 16:9 image_size); lightbox centers contain; optional sheet stat footer from filled Name · age · height · hair · eyes · build. Scene Builder P0 slots: Hero (walk-in wide), Opposite, Feature, Detail, Overview, Scene sheet — Detail is always available; camera applies to Hero only; the sheet lists attached stills only (no invented medium panel) and uses the same chips + Enhance as Character sheet. Scene T2I adds Flux 2 Max and GPT Image 2 (T2I + edit; size/quality from each schema; cost from estimate). Flux 2 Pro/Flex/Max T2I on Hero uses image_size enums (default landscape_16_9) and 1K / ~2K (4MP max) — no fake 4K; Flux edit is one Auto row.
Photoreal checkbox (default on) injects one photo-lock sentence at the end (never duplicated, never "not, not, not") — a style lock, not a Fal safety flag. Enhance strips cinematic/painterly/volumetric/concept-art/god rays even from Notes. Scene extra angles use locked cameras: Opposite is 180° from the far end of the square (not a copy of Hero); Feature is 3/4 of the landmark; Detail is one surface; Overview is unlabeled top-down; extra-angle prompts prepend "Do not copy the source camera angle."

**Creative Enhance** (off by default) sits next to Enhance wherever Enhance exists (Create Prompt, Storyboard master, Shot / SPB, Character / Costume / Scene / Prop, extra-angle and sheet Results, Frame pin I2I, Audio / SFX / Music, Hub notes). Hidden when there is no xAI key. Off is a tight rewrite for the selected model (facts only; Photoreal lock stays one sentence when that checkbox is on). On expands the brief into production detail that fits attached refs and scenario — set dressing, camera beat, wardrobe micro, SFX layers — without inventing a new location, character, or plot beat. Photoreal + Creative still reads as a photograph, not a painting. Creative is not a filter bypass and does not change the model. Storyboard master Enhance with Creative on may embroider shot-to-shot continuity from attached SPBs but must keep every shot’s camera and action.



Outputs for the packaged app: `%LOCALAPPDATA%\AI Media Studio V2\outputs\YYYY-MM-DD\`.

---

## Resolve handoff

Present in the packaged app.

- **From Resolve:** Library tab. Inbox folder is optional (Settings, or `RESOLVE_INBOX` / `AI_MEDIA_STUDIO_ROOT`). If unset, the tab is empty and `/resolve/status` says so. V1 sibling checkout is **not** required (`v1_root` is null in the package).
- **Send to Resolve:** sends the file into Resolve’s Media Pool when Resolve’s scripting API is available; otherwise the file is still in outputs / Library.

---

## Model Guide

In-app drawer (button next to Settings). Grouped T2I → I2I → I2V → R2V → audio → finish. Each entry has a tagline, strengths, watch-outs, and use cases. Ids match `GET /models`. Not a second catalog — it describes the one you already have.

---

## Cost estimates + spend

- Every Prompt / Tool shows **Est. cost** from `GET /estimate` (duration, audio, draft, image count) **before** you spend.
- After a job, spend is appended locally: `%LOCALAPPDATA%\AI Media Studio V2\spend.jsonl`.
- Settings shows this month’s total, count, and split by provider (fal / Runware / xAI). Export CSV is available.
- Retention of outputs is a Settings preference (default 90 days).

Estimates are helpers, not invoices. Provider dashboards are the source of truth.

---

## Privacy

- API keys sit in `%LOCALAPPDATA%\AI Media Studio V2\secrets.json` only. The packaged EXE does **not** read a repo `.env`.
- Settings shows whether a key is set and a last-4 mask — never the full value.
- Nothing phones home except the APIs you configure (fal, and optionally xAI / Runware). No analytics service in this app.
- Generated media stays on this PC under LOCALAPPDATA (and wherever you Send to Resolve).
- The app is free. You are billed by fal / xAI / Runware for usage on those accounts.
- Optional donations (PayPal) support development; the app stays free.

---

## What this is not

- Not a hosted SaaS. No included credits.
- Not a second catalog on Runware (Aleph / Frame only).
- Not an After Effects or Resolve plugin. Resolve is a handoff, not a host.
- Catalog will change as you add rows in the app; this file is a snapshot of **2.0.0-rc4**.
