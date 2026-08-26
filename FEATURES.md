# AI Media Studio V2 — Features

**Version:** 2.0.0-rc2 (Windows)

Free desktop app. You bring your own API keys. You pay the providers for what you generate — not a subscription to this app.

Catalog below is from the live app (`GET /models`, `GET /tools`) on 23 Aug 2026. Names match the in-app dropdowns.

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

## Create

Each mode is a Prompt node plus slots (source still, last frame, refs, elements). Duration, aspect, resolution, and native audio on/off appear when the model supports them. Advanced (when shown): seed, negative prompt, image count, FLUX 3 draft.

Cost is estimated before you generate.

Compare Source overlay on Result.

Mask node — boxes + brush; Fibo 1.5 single-source; white=edit.

### Image

| Path | What it does | Models in catalog |
|------|----------------|-------------------|
| **T2I** | Text to a still | Flux 2 Pro, Flux 2 (cheaper), Flux 2 Flex, Flux 1.1 Pro Ultra, Recraft V4, Qwen Image 3, Nano Banana 2 (fast), Nano Banana Pro, Seedream 4.5, Seedream 5.0 Lite, Seedream 5.0 Pro, Grok Imagine Image 2.0, **Fibo Gen 1.5** |
| **I2I** | Edit one still | Flux 2 Pro / Max / Flex, MAI-Image-2.5 Pro / 2.5, Nano Banana Pro / 2, Flux Kontext Pro, Grok Imagine Edit / Quality Edit / 2.0 Edit, Qwen Image 3, Seedream 5.0 Pro, **Fibo Edit 1.5** (multi-ref, optional mask on single-ref), Fibo Edit v1 (optional mask) |
| **R2I** | Edit from extra reference stills | Flux 2 Pro / Max / Flex, Nano Banana Pro / 2, Grok Imagine Edit / Quality / 2.0, Qwen Image 3, Seedream 5 Pro R2I, **Fibo Edit 1.5** (up to 4 images, `<image_1>`… tags) |
| **Region** | Grounded region edit (box on the still) | Seedream 5 Pro (edit) |

Default image model: Flux 2 Pro (edit).

### Video

| Path | What it does | Models in catalog |
|------|----------------|-------------------|
| **T2V** | Text to a clip | Veo 3.1 / Fast, Luma Ray 2, MiniMax H3, Grok Imagine 1.5, FLUX 3 (draft available), Seedance 2.5, **Wan 3.0** (up to 30s @ 1080p, native audio), LTX 2.5 Pro / Fast, Kling 3.0 Pro / Standard (native multi-shot), Kling O3 Pro / Standard, Mirage Avatar X |
| **I2V** | Animate a start still (optional last frame on flagged models) | Grok Imagine 1.5, Kling O3 Standard / Pro, Kling 3.0 Standard / Pro (elements + multi-shot + last frame), Kling 2.6 Pro, Kling 2.5 Turbo Pro, Seedance 2.5 (last frame), **Wan 3.0** (last frame, 30s @ 1080p), FLUX 3 I2V (draft), FLUX 3 First→Last, MiniMax H3, Veo 3.1 Fast / 3.1, LTX 2.5 Pro / Fast |
| **R2V** | Refs (stills, and on some models video/audio) | MiniMax H3 Omni (default), Seedance 2.5, **Wan 3.0** (10 image refs + video/audio, cite Image 1 / Image 2), Grok Imagine 1.5, Veo 3.1 reference pack, FLUX 3 identity ref (draft), Mirage Avatar X |
| **V2V** | Edit or retake an existing clip | Kling O3 Standard / Pro edit (elements), LTX 2.3 Retake, Grok Imagine Edit Video, FLUX 3 Extend (draft), sync-3 lipsync (needs dialogue audio; prompt unused) |
| **Bridge** | First still → last still | Veo 3.1 Fast / 3.1, Kling O3 Pro / Standard, FLUX 3, Seedance 2.5, MiniMax H3, Wan 3.0 (I2V last frame) |
| **Extend** | Continue a clip | FLUX 3 Extend |

Default video model: Kling O3 Standard V2V edit.

**Listing-oriented notes (not a ranking):**

- Last-frame I2V is on Kling 3.0, Kling O3, Seedance 2.5, MiniMax H3, LTX 2.5, Wan 3.0, and the dedicated Bridge / First→Last rows.
- **Wan 3.0** (T2V / I2V / R2V): up to 30s @ 1080p, native audio, cost scales with seconds × resolution. R2V locks character/scene from up to 10 stills (cite Image 1 / Image 2 in the prompt).
- Kling 3.0 I2V can lock characters with **Elements** (`@Element1` …) and cut a board with **native multi-shot**.
- FLUX 3 can run a cheap **draft**, then Enhance to full quality on the same motion.
- Seedance 2.5 can refuse some photoreal faces. Prefer I2V (start / last frame) over R2V for synthetic people. There is no safety-off switch.

### Audio

| Kind | Models |
|------|--------|
| **Music** | MiniMax Music 3 (default), MiniMax Music 2.6, Sonilo v1.1, ElevenLabs Music, Google Lyria 3 Pro, Google Lyria 2, Stable Audio 2.5 |
| **SFX** | ElevenLabs Sound Effects V2, Sonilo Text-to-SFX |
| **Voiceover** | MiniMax Speech 02 HD, Grok TTS, ElevenLabs Eleven v3, ElevenLabs Turbo v2.5 |

Instrumental is a toggle on music models that support it. Voice is a dropdown on TTS models that ship a voice list.

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

- **Asset Hub:** characters, scenes, props (and costumes when you have them).
- **Shots:** action / camera, duration budget, start stills.
- Default model: **MiniMax H3 Omni** (reference-to-video).
- Also in the storyboard list: Seedance 2.5 R2V, Grok Imagine 1.5 R2V, Veo 3.1 reference, FLUX 3 identity R2V, Mirage Avatar X, **Kling 3.0** Standard/Pro I2V and T2V.

When the model supports it (Kling 3.0):

- Shots go out as native **`multi_prompt`** (customize or intelligent cuts), not one flattened paragraph.
- **Elements** tray on Kling 3.0 I2V (`@ElementN`). Hidden on Kling T2V.

Other storyboard models still flatten the board into one R2V prompt plus hub/shot refs. Last frame is not sent from Storyboard (use Video I2V / Bridge for that).

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

**Assets:** characters, scenes, props (costumes API is there for sheets). Hub on Storyboard reads these. You can attach stills and reuse them as refs or Kling elements.

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
- Catalog will change as you add rows in the app; this file is a snapshot of **2.0.0-rc2**.
