# BUILD — API Model Gap Brief (rc5 wiring pass)

**Date:** 2026-09-21 (America/Edmonton)  
**Audience:** Build / Alfred — AI Media Studio V2 (`darcyallen-tech/ai-media-studio-v2`)  
**Purpose:** Concrete Have vs Missing for the next API catalog pass. Priorities for wiring, not marketing.

**Baseline inventory sources (CURRENT):**
- Public repo `FEATURES.md` labeled **2.0.0-rc5** (Windows)
- Live registries: `backend/app/fal/models.py`, `backend/app/vision_registry.py`, `backend/app/audio_registry.py`
- Frame Editor: Runware **Aleph 2.0** only (`runway:aleph@2.0`)
- Cross-check: Fal catalog scan 2026-09-21 (~1,512 endpoints) + Runware changelog + ElevenLabs models docs

**HARD EXCLUDE:** MiniMax Hailuo **H3 Max / H3 styles / H3-max variants** are **not** wiring priorities for Darcy (even if already shipped). Do not expand that family further in this pass.

---

## Summary table — Have vs Missing

| Category | CURRENT (wired / visible) | Notable MISSING (candidates) |
| --- | --- | --- |
| **Image T2I** | Flux 2 Pro/Flex/cheap, Recraft V4, Qwen Image 3, Nano Banana 2/Pro, Seedream 5 Lite/Pro, Grok Imagine 2.0, Fibo Gen 1.5, Muse Image; Scene/Character also use **GPT Image 2** (`openai/gpt-image-2`) | **GPT Image 2.5 Flare + Sunburst** T2I (Fal + Runware) |
| **Image I2I / R2I / Edit** | Flux 2 Pro/Max/Flex edit, MAI 2.5/Pro, Nano Banana Pro/2, Kontext Pro, Grok 2.0 Edit, Qwen 3, Seedream 5 Pro (+ mask), Fibo Edit 1.5 (+ mask), Muse Edit; GPT Image 2 edit (Scene) | **GPT Image 2.5 Flare/Sunburst edit**; optional Bria VTON / Product Holding tools |
| **Video T2V / I2V / R2V** | Veo 3.1/Fast, Ray 3.2 T2V, H3 (+ Max family already in catalog), Grok 1.5, FLUX 3 (+ draft), Seedance 2.5, Wan 3.0, LTX 2.5, Kling 3.0 / O3, Mirage Avatar X, Gemini Omni Flash 1.1 | Optional: Creatify Boreal; Seedance US mirrors only if residency needed; **skip expanding H3 Max** |
| **Video V2V / edit** | Kling O3 Std/Pro edit, Kling O3 4K edit/reference, LTX 2.3 Retake, Grok edit video, FLUX 3 Extend, sync-3 lipsync, Gemini Omni 1.1 edit | **ID-V2V** (+ Relight) as short/mid pin-edit Fal path; **Ray 3.2 V2V** short-only; keep **Aleph** |
| **Audio Music** | MiniMax Music 3 (default), ACE-Step 1.5 / YuE2 (local Comfy), Sonilo v1.1, **ElevenLabs Music** (`fal-ai/elevenlabs/music`), Lyria 3 Pro, Stable Audio 2.5 | **ElevenLabs Music v2.5** (`elevenlabs/music/v2.5`); **Google Lyria 3.5** (`google/lyria-3.5`) |
| **Audio SFX** | ElevenLabs SFX V2, Sonilo T2SFX (+ video→SFX lanes already present) | No major Fal SFX gap; SFX V2 already current |
| **Audio TTS / STT / Other** | MiniMax Speech 2.8/2.6 HD, Grok TTS, Eleven v3, Turbo v2.5; video→audio helpers | **Scribe v2 STT** (`fal-ai/elevenlabs/speech-to-text/scribe-v2`); optional Dialogue v3; Flash TTS **not on Fal** (Turbo remains) |
| **Frame Editor** | **Aleph 2.0 (Runware)** — keep | No full Fal replacement; ID-V2V / Ray = partial only |
| **Runware-only media** | Aleph only (by design) | P-Video-2 / P-Video-2-Pro / P-Video-Edit (optional scout); Flare/Sunburst also on Runware but **prefer Fal** for Create catalog |

---

## 1. Image — T2I / Edit / R2I

### Current (short)

| Lane | Provider | Model / endpoint (representative) |
| --- | --- | --- |
| T2I default stack | Fal | `fal-ai/flux-2-pro`, `fal-ai/flux-2`, `fal-ai/flux-2-flex`, `fal-ai/recraft/v4/text-to-image`, `alibaba/qwen-image-3/text-to-image`, `fal-ai/nano-banana-2`, `fal-ai/nano-banana-pro`, Seedream 5 Lite/Pro, `xai/grok-imagine-image/v2.0/text-to-image`, `bria/fibo-gen-1.5/text-to-image`, `meta/muse-image/text-to-image` |
| I2I / R2I | Fal | Flux 2 Pro/Max/Flex `/edit`, MAI 2.5, Nano Banana Pro/2 edit, `fal-ai/flux-pro/kontext`, Grok Imagine 2.0 edit, Qwen 3 edit, Seedream 5 Pro edit, `bria/fibo-edit-1.5/edit`, `meta/muse-image/edit` |
| GPT Image (partial) | Fal | **`openai/gpt-image-2`** + **`/edit`** — present for Scene Builder / character surfaces; **not** the 2.5 Flare/Sunburst family |

### Missing / candidates

| Pri | Name | Why | Provider | Model ID | Notes |
| --- | --- | --- | --- | --- | --- |
| **P0** | **GPT Image 2.5 Flare** T2I + Edit | Default OpenAI image lane post–Sep 8: higher quality than GPT Image 2 at ~½ latency; up to 3840px; quality `xhigh`/`max`; up to 16 refs; transparent BG | **Fal** (also Runware) | `openai/gpt-image-2.5/flare/text-to-image` · `openai/gpt-image-2.5/flare/edit` | Wire as primary GPT Image 2.5 row. Runware twin: `openai:gpt-image@2.5-flare` — use only if Fal path fails; Create catalog stays Fal-first. |
| **P0** | **GPT Image 2.5 Sunburst** T2I + Edit | Precision / multi-round edit sibling; same pricing as Flare, slower, finer detail | **Fal** (also Runware) | `openai/gpt-image-2.5/sunburst/text-to-image` · `openai/gpt-image-2.5/sunburst/edit` | Second dropdown row (“premium detail”). Runware: `openai:gpt-image@2.5-sunburst`. |
| P1 | Bria FIBO-Edit-1.5 Virtual Try-On | Cheap multi-garment VTON ($0.04) for wardrobe/character | Fal | `bria/fibo-edit-1.5/virtual-try-on` | Tool or Create specialty; published ~2026-09-17 |
| P1 | Bria FIBO-Edit-1.5 Product Holding | Lifestyle product-in-hand stills ($0.04) | Fal | `bria/fibo-edit-1.5/product-holding` | Listing / UGC stills |
| P2 | Keep GPT Image 2 | Already useful; streaming + BYOK notes differ from 2.5 | Fal | `openai/gpt-image-2` (+ `/edit`) | Do not delete; demote below Flare once 2.5 ships |

**Sunburst / Flare naming (exact):** OpenAI GPT Image **2.5** variants on Fal — not separate “Sunburst”/"Flare" products from another lab. Both Fal and Runware ship them.

---

## 2. Video — T2V / I2V / R2V / V2V

### Current (short)

| Lane | Highlights (Fal unless noted) |
| --- | --- |
| T2V | Veo 3.1 / Fast, `luma/agent/ray/v3.2/text-to-video`, MiniMax H3 (+ Max / Max Turbo already in catalog), Grok 1.5, FLUX 3 (+ draft), Seedance 2.5, Wan 3.0, LTX 2.5 Pro/Fast, Kling 3.0 / O3, Mirage Avatar X, Gemini Omni Flash 1.1 |
| I2V / Bridge | Same families; last-frame / first→last on Kling, Seedance, H3, Wan, Veo, FLUX 3, Gemini Omni, etc. |
| R2V | H3 Omni, H3 Max R2V, Seedance 2.5, Wan 3.0, Grok 1.5, Veo reference, FLUX 3 identity, Mirage, Gemini Omni |
| V2V | Kling O3 Std/Pro edit, **Kling O3 4K edit/reference**, LTX Retake, Grok edit video, FLUX 3 Extend, sync-3, Gemini Omni edit |
| Frame Editor | **Runware Aleph 2.0** only — keep until Fal has a true 2–30s pin-frame replacement |

### Missing / candidates

| Pri | Name | Why | Provider | Model ID | Notes |
| --- | --- | --- | --- | --- | --- |
| **P0** | **Keep Aleph 2.0** | Only full Frame Editor length/res (source 2–30s, up to 5 pin stills) | Runware | `runway:aleph@2.0` | **Do not remove.** Fal still has no equal. |
| **P1** | **ID-V2V** (+ Relight) | First Fal schema with source clip + restyled first frame + optional indexed keyframes — Aleph-class *partial* | Fal | `fal-ai/id-v2v` · `fal-ai/id-v2v/relight` | ~$0.20/s; ≤241 frames; 480p/720p. **Partial only** — not a Frame Editor swap. Offer as Create V2V “identity restyle” / short pin-edit. |
| **P1** | **Luma Ray 3.2 V2V** | Source video + start image / up to 64 keyframes + indexes | Fal | `luma/agent/ray/v3.2/video-to-video` | Duration enum **5s \| 10s only**. AMS already has Ray 3.2 **T2V**. Wire V2V as short-clip Frame/V2V option only. |
| P2 | FLUX 3 Fast Edit Video | Prompt V2V sibling (Fal Sep 11 window) | Fal | check live `blackforestlabs/flux-3/...edit...` / Fal “FLUX Video Edit [fast]” | Nice-to-have beside Kling O3 edit; verify exact endpoint ID before wiring |
| P2 | Creatify Boreal | Product/UGC presenter video+audio | Fal | Creatify Boreal (Sep 16 watch) | Specialty listing lane |
| P2 | Seedance 2.5 **US** T2V/I2V/R2V | US-hosted mirrors only | Fal | `bytedance/seedance-2.5/us/*` | Worse max res + higher $/s than non-US 2.5 — only if residency/latency required |
| — | H3 Max Lip Sync / Multi Angle / etc. | Already in Fal; **out of scope for this pass** | Fal | `minimax/h3-max/...` | See Skip |

**Runware-only video (optional, not Create default):**
- `P-Video-2` / **`P-Video-2-Pro`** (Pruna) — draft/quality scout; **Fal has no Pruna**
- `P-Video-Edit` — instruction V2V up to 15s  
AMS policy today: Runware = Frame Editor only. Expanding Create onto Runware is a product decision, not required for Flare/Sunburst (those are on Fal).

---

## 3. Audio — Music / SFX / TTS / STT

### Current (short)

| Kind | Wired |
| --- | --- |
| Music | `minimax/music-3` (default), Comfy ACE-Step 1.5 + YuE2, `sonilo/v1.1/text-to-music`, **`fal-ai/elevenlabs/music`**, `fal-ai/lyria3/pro`, `fal-ai/stable-audio-25/text-to-audio` |
| SFX | `fal-ai/elevenlabs/sound-effects/v2`, Sonilo T2SFX (+ video→SFX / Mirelo / Kling V2A already in registry) |
| Voiceover | MiniMax Speech 2.8 HD / 2.6 HD, `xai/tts/v1`, `fal-ai/elevenlabs/tts/eleven-v3`, `fal-ai/elevenlabs/tts/turbo-v2.5` |

### Missing / candidates

| Pri | Name | Why | Provider | Model ID | Notes |
| --- | --- | --- | --- | --- | --- |
| **P0** | **ElevenLabs Music v2.5** | Current ElevenMusic default (Sep 11); richer arrangements; Fal endpoint live | Fal | **`elevenlabs/music/v2.5`** | Replace or sibling-above `fal-ai/elevenlabs/music`. ~$0.60 / output minute (rounded up). Supports composition_plan, `force_instrumental`, length 3s–600s. |
| **P0** | **Google Lyria 3.5** | Newest Google music on Fal (published 2026-09-19) | Fal | **`google/lyria-3.5`** | Flat **$0.10 / gen**; optional `image_url`; full songs “up to a few minutes”; multilingual. Catalog sibling above Lyria 3 Pro (`fal-ai/lyria3/pro` @ $0.08). |
| **P1** | **ElevenLabs Scribe v2** STT | Studio gap: clip → transcript / captions / VO QC | Fal | `fal-ai/elevenlabs/speech-to-text/scribe-v2` | New Tools or Audio STT modality. ~$0.008 / input minute. |
| P2 | ElevenLabs Text-to-Dialogue v3 | Multi-speaker dialogue | Fal | `fal-ai/elevenlabs/text-to-dialogue/eleven-v3` | Optional VO tool |
| P2 | ElevenLabs Music v2 (explicit) | Stable prior | Fal | `elevenlabs/music/v2` | Only if you want pinned legacy beside v2.5 |
| — | Eleven Flash TTS | Official preferred low-latency TTS | ElevenLabs direct | `eleven_flash_v2_5` | **Not on Fal** as of 2026-09-21 (404). Keep Turbo v2.5 on Fal; Flash needs direct ElevenLabs key path if ever required. |
| — | Music v2.5 via Runware | N/A | — | — | Runware deprecated ElevenLabs models (Jun 2026); use Fal |

**SFX:** V2 already wired — no upgrade required this pass.

---

## 4. Other / Tools

| Pri | Item | Notes |
| --- | --- | --- |
| P2 | Forced alignment | `fal-ai/elevenlabs/forced-alignment` — niche; skip unless caption tooling expands |
| FYI | Runware deprecations | GPT Image 1 → Image 2 (Oct 23); Nano Banana → Banana 2 (Oct 2); Sora 2/Pro (Sep 24); Seedance 1.5 Pro (Nov 11) — irrelevant if Create stays Fal-first |

---

## Skip (do not prioritize)

| Item | Reason |
| --- | --- |
| **MiniMax H3 Max / H3 Max Turbo / H3 Max R2V / Lip Sync / Camera Controls / H3 styles** | Explicit Darcy exclude for this pass — even where already in catalog, do not expand or spend Build time on new H3 Max SKUs |
| Seedance 2.5 US / Seedance 2.0 US mirrors | Region mirror only; keep default non-US 2.5 |
| Official Suno API | Still no public self-serve API; not on Fal/Runware |
| Treating ID-V2V or Ray 3.2 V2V as Aleph replacement | Length/res gaps; keep Runware Aleph for Frame Editor |
| Expanding Create catalog onto Runware for Flare/Sunburst | Unnecessary — Fal has full Flare/Sunburst |
| Runware P-Video family as P0 | Useful scout, but policy today is Frame-only Runware; Fal-first Create |
| Eleven Flash on Fal | Endpoint not published |
| Hype / LLM-only Runware adds (GPT-6 Astra, etc.) | Out of media-studio scope |

---

## Suggested Build order (top 10)

1. **GPT Image 2.5 Flare** T2I + Edit (`openai/gpt-image-2.5/flare/*`) — Create + Scene/Character pickers  
2. **GPT Image 2.5 Sunburst** T2I + Edit (`openai/gpt-image-2.5/sunburst/*`) — premium sibling  
3. **ElevenLabs Music v2.5** (`elevenlabs/music/v2.5`) — Music dropdown; keep old `fal-ai/elevenlabs/music` hidden/callable  
4. **Google Lyria 3.5** (`google/lyria-3.5`) — Music dropdown above Lyria 3 Pro  
5. **Confirm / document Keep Aleph** — no Fal Frame Editor swap this pass  
6. **ID-V2V** (+ optional Relight) — V2V / short pin-edit (label as partial vs Aleph)  
7. **Ray 3.2 video-to-video** — short 5/10s V2V only  
8. **Scribe v2** STT — Tools or Audio STT  
9. Bria VTON + Product Holding — Tools (optional e-comm)  
10. Cost/estimate + Model Guide rows for all of the above  

---

## Frame Editor policy (explicit)

| Backend | Role |
| --- | --- |
| **Runware Aleph 2.0** | **Keep** — only full 2–30s pin-edit-apply path |
| Fal **ID-V2V** | Partial: source + edited first frame + optional keyframes; frame-count capped; 480p/720p |
| Fal **Ray 3.2 V2V** | Partial: pin keyframes but **5s/10s only** |
| Existing Kling O3 / Gemini Omni / LTX Retake | Prompt V2V — not Frame Editor |

---

## Sources

| URL | Role |
| --- | --- |
| https://github.com/darcyallen-tech/ai-media-studio-v2 (`FEATURES.md`, `backend/app/fal/models.py`, `vision_registry.py`, `audio_registry.py`) | CURRENT wiring |
| https://fal.ai/gpt-image-2.5 | Flare / Sunburst product |
| https://fal.ai/models/openai/gpt-image-2.5/flare/text-to-image · `/flare/edit` · `/sunburst/text-to-image` · `/sunburst/edit` | Exact Fal IDs |
| https://runware.ai/docs/models/openai-gpt-image-2-5-flare · `...-sunburst` | Runware IDs `openai:gpt-image@2.5-flare` / `@2.5-sunburst` |
| https://fal.ai/models/elevenlabs/music/v2.5 | Music v2.5 |
| https://elevenlabs.io/docs/overview/models.md · https://elevenmusic.io/blog/introducing-music-v2-5 | ElevenLabs model IDs / Music v2.5 |
| https://fal.ai/models/google/lyria-3.5 | Lyria 3.5 |
| https://fal.ai/models/fal-ai/id-v2v · `/relight` | ID-V2V |
| https://fal.ai/models/luma/agent/ray/v3.2/video-to-video | Ray 3.2 V2V |
| https://fal.ai/models/fal-ai/elevenlabs/speech-to-text/scribe-v2 | Scribe v2 |
| https://runware.ai/docs/changelog | Runware Sep 2026 (P-Video-2-Pro, Flare/Sunburst, deprecations) |
| https://runware.ai/docs/models/runway-aleph-2-0 | Aleph keep |
| Internal model watches 2026-09-09 … 2026-09-21 | Gap timeline since ~rc4 / late Aug–Sep |

---

## Uncertainty flags

1. **Windows live tree:** This brief used public GitHub **rc5** registries + FEATURES. Local `C:\Users\Darcy\ai-media-studio-v2` may be slightly ahead/behind; re-diff `audio_registry.py` / `vision_registry.py` before coding if local commits exist.  
2. **FLUX 3 Fast Edit Video** exact Fal path — confirm on Fal playground before wiring (name varies in watches vs catalog).  
3. **Creatify Boreal** endpoint slug — confirm live Fal ID when implementing.  
4. ElevenLabs **Flash** TTS remains Fal-absent; do not promise a Fal Flash row.  
5. AMS already lists some **H3 Max** rows — treat as “have, do not expand,” not “delete,” unless Darcy asks.

