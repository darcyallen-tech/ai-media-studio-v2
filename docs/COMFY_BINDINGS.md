# Comfy workflow bindings

Inspected 2026-09-06; qwen_multi_r2i added 2026-09-14 from `workflows/comfy/` API-export JSON. Edit `workflows/comfy/bindings.json` if a widget name changes â€” do not guess at runtime.

ACE (`audio_ace_step_1_5_split.json`) is in this folder **unwired**.

## zimage_t2i â€” `ZimageTurbo T2I.json`

| Binding | Selector (class_type / title) | Input key | Notes |
|---------|-------------------------------|-----------|--------|
| prompt | `CLIPTextEncode` title **Prompt** | `text` | |
| seed | `RandomNoise` | `noise_seed` | Not KSampler. Sampler is `SamplerCustomAdvanced`. |
| aspect_ratio | `ResolutionSelector` | `aspect_ratio` | Locked `9:16 (Portrait Widescreen)` |
| megapixels | `ResolutionSelector` | `megapixels` | Locked `2` (~2 MP). EmptyLatentImage width/height are **links** from this node â€” do not patch those as scalars. |

## qwen_angle â€” `Qwen R2I - Multiple Angles Generator.json`

| Binding | Selector | Input key | Notes |
|---------|----------|-----------|--------|
| image | title **IMAGE1** (`LoadImage`) | `image` | Only IMAGE1. IMAGE2/IMAGE3 already removed. |
| h_angle | `QwenMultiangleCameraNode` title **Qwen Multiangle Camera** | `horizontal_angle` | Not `Horizontal Angle`. |
| v_angle | same | `vertical_angle` | |
| zoom | same | `zoom` | |
| default_prompts | same | `default_prompts` | ON: leave cameraâ†’encode link (short `<sks>` string). OFF: replace link with `Do not change appearance or clothing.` |
| prompt | `TextEncodeQwenImageEditPlus` | `prompt` | Positive encode is a **link** from the camera node. Default Prompts ON leaves that link. Empty negative encode is left alone. |
| seed | `KSampler` | `seed` | |

Camera table (H, V, Zoom):

| Angle | slot | H | V | Zoom |
|-------|------|---|---|------|
| Front Â¾ | `threequarter_front` | 45 | 0 | 4 |
| Side | `side` | 90 | 0 | 4 |
| Back Â¾ | `threequarter_back` | 135 | 0 | 4 |
| Back | `back` | 180 | 0 | 4 |
| Close-up | `closeup` | 0 | 0 | 10 |
| Top | `top` | 0 | 70 | 4 |

Front still uses Z-Image, not this table.

## seedvr_confirm â€” `SeedVR2 Image Upscale.json`

| Binding | Selector | Input key | Forced |
|---------|----------|-----------|--------|
| image | `LoadImage` title **Load Image** | `image` | uploaded still |
| max_resolution | `SeedVR2VideoUpscaler` title **SeedVR2 Video Upscaler (v2.5.24)** | `max_resolution` | **3840** |
| batch_size | same | `batch_size` | **1** |
| temporal_overlap | same | `temporal_overlap` | **0** |
| prepend_frames | same | `prepend_frames` | **0** |

Class type is `SeedVR2VideoUpscaler` (no space). Long-edge cap 3840. Writes `*_4k.png` next to the 2 MP still; Qwen angles keep using the 2 MP Front.

## qwen_multi_r2i — `QWEN IMAGE EDIT 2511 MULTI R2I.json`

General multi-reference edit (up to **3** refs) for AIMS local Comfy. Not the angle generator.

| Binding | Selector | Input key | Notes |
|---------|----------|-----------|--------|
| image1 | title **IMAGE1** (`LoadImage`) | `image` | Upload then patch filename |
| image2 | title **IMAGE2** (`LoadImage`) | `image` | Optional; reuse image1 path if unused |
| image3 | title **IMAGE3** (`LoadImage`) | `image` | Optional; reuse image1 path if unused |
| prompt | title **Positive Prompt** (`TextEncodeQwenImageEditPlus`) | `prompt` | Refer to Image1 / Image2 / Image3 in text |
| negative | title **Negative Prompt** (`TextEncodeQwenImageEditPlus`) | `prompt` | Usually empty |
| aspect_ratio | `ResolutionSelector` | `aspect_ratio` | Default `16:9 (Widescreen)` |
| megapixels | `ResolutionSelector` | `megapixels` | Default `2` |
| seed | `KSampler` | `seed` | |
| steps | `KSampler` | `steps` | Default **4** (Edit Lightning) |
| cfg | `KSampler` | `cfg` | Default **1** |

Pinned weights (Darcy `D:\ComfyUI\models`):
- UNET: `qwen_image_edit_2511_int8_convrot.safetensors`
- CLIP: `qwen_2.5_vl_7b_fp8_scaled.safetensors` (`type=qwen_image`)
- VAE: `qwen_image_vae.safetensors`
- LoRA: `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` @ strength 1
- Refs: shortest side scaled to 1024 (letterbox, multiple of 16)
- `FluxKontextMultiReferenceLatentMethod` = `index_timestep_zero`
- AuraFlow shift = 3

**Runtime gap:** `run_workflow()` today only auto-uploads a single `source_image` into a binding field named `image`. For multi-R2I, upload each still via `/upload/image`, then pass `image1`/`image2`/`image3` filenames in `values` (or extend the client). Do not use class_type `TextEncodeQwenImageEditPlus` alone for prompt — that would also hit Negative.

Custom nodes required: `LayerUtility: ImageScaleByAspectRatio V2`, `ResolutionSelector`, `TextEncodeQwenImageEditPlus`, `FluxKontextMultiReferenceLatentMethod`, `ModelSamplingAuraFlow`.


## qwen_r2i_1ref — `QWEN IMAGE EDIT 2511 R2I 1REF.json`

Same stack as multi (Edit 2511 int8 + Edit Lightning 4-step). One ref.

| Binding | Selector | Input key |
|---------|----------|-----------|
| image / image1 | **IMAGE1** | `image` |
| prompt / negative | **Positive Prompt** / **Negative Prompt** | `prompt` |
| aspect_ratio / megapixels | `ResolutionSelector` | … |
| seed / steps / cfg | `KSampler` | … |

## qwen_r2i_2ref — `QWEN IMAGE EDIT 2511 R2I 2REF.json`

Same as 1-ref with **IMAGE1** + **IMAGE2**.

## qwen_multi_r2i_quality — `QWEN IMAGE EDIT 2511 MULTI R2I QUALITY.json`

3-ref, **no Lightning**. Defaults: steps **28**, cfg **3**. Same IMAGE1–3 / Positive / Negative selectors as `qwen_multi_r2i`.

## qwen_multi_r2i_skin — `QWEN IMAGE EDIT 2511 MULTI R2I SKIN.json`

3-ref Lightning + `qwen-edit-skin_1.1_000002750.safetensors` @ 0.85 after Lightning.

## klein_multi_r2i — `FLUX.2 KLEIN MULTI R2I.json`

FLUX.2 Klein 9B int8 + `Flux2KleinMultiReferenceLatent` (3 refs) + `IdentityFeatureTransferFinal` (MID_LOCK). Needs **ComfyUI-Flux2Klein-Enhancer**.

| Binding | Selector | Input key |
|---------|----------|-----------|
| image1–3 | **IMAGE1–3** | `image` |
| prompt | title **Prompt** (`CLIPTextEncode`) | `text` |
| seed | `SamplerCustom` | `noise_seed` |
| steps | `BasicScheduler` | `steps` |
| cfg | `SamplerCustom` | `cfg` |
| aspect_ratio / megapixels | `ResolutionSelector` | … |

## klein_r2i_1ref — `FLUX.2 KLEIN R2I 1REF.json`

Single-ref via core `ReferenceLatent` (no Identity lock). Same Klein weights.

## zimage_sheet_front — `ZIMAGE SHEET FRONT T2I.json`

Z-Image Turbo + Radiant LoRA @ 0.7. Character-sheet Front T2I helper (not multi-R2I).

| Binding | Selector | Input key |
|---------|----------|-----------|
| prompt | **Prompt** | `text` |
| seed | `RandomNoise` | `noise_seed` |
| aspect_ratio / megapixels | `ResolutionSelector` | … |

## krea2_sheet_front — `KREA2 TURBO SHEET FRONT T2I.json`

Local Krea2 turbo int8 + `qwen3vl_4b_fp8_scaled` + `qwen_image_vae`. Darkbrush LoRA present at strength **0** (off). Sheet Front helper.

| Binding | Selector | Input key |
|---------|----------|-----------|
| prompt | **Prompt** | `text` |
| seed | `SamplerCustom` | `noise_seed` |
| aspect_ratio / megapixels | `ResolutionSelector` | … |


## YuE2 music — local Comfy, `$0.00`

Workflows stay in `workflows/comfy/` (API format). AMS loads them from that folder. Settings `COMFY_URL` only. If Comfy is down, the same health error as ACE-Step is returned. There is no fal fallback.

Poll waits up to **20 minutes**. Save node **109** (`SaveModernAudio`) writes **WAV** with prefix `AIMS_YuE2_`.

### yue2_t2m — `YuE2 TEXT TO MUSIC GROK ROCK.json`

Alias: `yue2_grok_rock`.

| Binding | Node | Input | Notes |
|---------|------|-------|--------|
| style | **113** `PrimitiveStringMultiline` | `value` | Title **Style** |
| lyrics | **114** `PrimitiveStringMultiline` | `value` | Title **Lyrics** |
| mode | 25 and 24 | `mode` | Same `full` or `melody` on Generate Music and Generate ABC. Default `full` |
| max_duration | 25 | `max_duration` | Request budget only. Node **5** `seconds` stays the link `["25", 1]` |
| seed_abc / seed_music / seed_sampler | 24 / 25 / 8 | `seed` | |
| steps | 8 | `steps` | Default 32. cfg 1, `dpm_2`, `sgm_uniform` stay on the graph |

**Do not patch `24.style`, `24.lyrics`, `25.style`, or `25.lyrics`.** On this graph those inputs are links from 113 and 114. Writing a string there replaces the link.

**Do not patch node 5 `seconds`.** It is a link from Music output 1. Pasted scores belong on Re-render from ABC, not this graph. Music.abc is a direct link from node 24.

Checkpoint node 15: `yue2_3b_bf16.safetensors`.

### yue2_cover — `YuE2 COVER.json`

| Binding | Node | Input | Notes |
|---------|------|-------|--------|
| audio | 45 `LoadAudio` | `audio` | Filename after Comfy upload |
| style / lyrics | 25 | scalars | Inline on this graph (not links) |
| sheetsage_mode | 41 | `mode` | Default `melody` |
| music_mode | 25 | `mode` | Default `melody` |
| max_duration | 25 | `max_duration` | Default 120s |
| seeds / steps | 25 / 8 | | |

Encoder node 43: `sheetsage2_bf16.safetensors`.

### yue2_rerender_abc — `YuE2 RERENDER FROM ABC.json`

| Binding | Node | Input |
|---------|------|-------|
| abc | 50 | `value` |
| style / lyrics | 25 | scalars |
| mode / max_duration | 25 | default mode `full`, duration 120s |
| seeds / steps | 25 / 8 | |

No ABC generator. Weights are **CC-BY-NC** (personal/testing; not for selling tracks as-is).

## Runtime

- Health: `GET {COMFY_URL}/system_stats` (JSON `devices` / `system`)
- Upload: `POST {COMFY_URL}/upload/image` (optional `COMFY_INPUT_DIR` copy)
- Queue: `POST {COMFY_URL}/prompt` `{ "prompt", "client_id": "ams-v2" }`
- Poll: `GET /history/{prompt_id}` every 1s, timeout 10 min
- Default URL: `http://127.0.0.1:8188`
- Hardware note: workflows built on RTX 5070 Ti; **16 GB VRAM recommended**


