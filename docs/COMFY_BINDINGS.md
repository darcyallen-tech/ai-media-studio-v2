# Comfy workflow bindings

Inspected 2026-09-06 from `workflows/comfy/` API-export JSON. Edit `workflows/comfy/bindings.json` if a widget name changes — do not guess at runtime.

ACE (`audio_ace_step_1_5_split.json`) is in this folder **unwired**.

## zimage_t2i — `ZimageTurbo T2I.json`

| Binding | Selector (class_type / title) | Input key | Notes |
|---------|-------------------------------|-----------|--------|
| prompt | `CLIPTextEncode` title **Prompt** | `text` | |
| seed | `RandomNoise` | `noise_seed` | Not KSampler. Sampler is `SamplerCustomAdvanced`. |
| aspect_ratio | `ResolutionSelector` | `aspect_ratio` | Locked `9:16 (Portrait Widescreen)` |
| megapixels | `ResolutionSelector` | `megapixels` | Locked `2` (~2 MP). EmptyLatentImage width/height are **links** from this node — do not patch those as scalars. |

## qwen_angle — `Qwen R2I - Multiple Angles Generator.json`

| Binding | Selector | Input key | Notes |
|---------|----------|-----------|--------|
| image | title **IMAGE1** (`LoadImage`) | `image` | Only IMAGE1. IMAGE2/IMAGE3 already removed. |
| h_angle | `QwenMultiangleCameraNode` title **Qwen Multiangle Camera** | `horizontal_angle` | Not `Horizontal Angle`. |
| v_angle | same | `vertical_angle` | |
| zoom | same | `zoom` | |
| prompt | `TextEncodeQwenImageEditPlus` | `prompt` | Positive encode is a **link** from the camera node; client replaces that link with the short camera lock. Empty negative encode is left alone. |
| seed | `KSampler` | `seed` | |

Camera table (H, V, Zoom):

| Angle | slot | H | V | Zoom |
|-------|------|---|---|------|
| Front ¾ | `threequarter_front` | 45 | 0 | 4 |
| Side | `side` | 90 | 0 | 4 |
| Back ¾ | `threequarter_back` | 135 | 0 | 4 |
| Back | `back` | 180 | 0 | 4 |
| Close-up | `closeup` | 0 | 0 | 9 |
| Top | `top` | 0 | 70 | 4 |

Front still uses Z-Image, not this table.

## seedvr_confirm — `SeedVR2 Image Upscale.json`

| Binding | Selector | Input key | Forced |
|---------|----------|-----------|--------|
| image | `LoadImage` title **Load Image** | `image` | uploaded still |
| max_resolution | `SeedVR2VideoUpscaler` title **SeedVR2 Video Upscaler (v2.5.24)** | `max_resolution` | **3840** |
| batch_size | same | `batch_size` | **1** |
| temporal_overlap | same | `temporal_overlap` | **0** |
| prepend_frames | same | `prepend_frames` | **0** |

Class type is `SeedVR2VideoUpscaler` (no space). Long-edge cap 3840. Writes `*_4k.png` next to the 2 MP still; Qwen angles keep using the 2 MP Front.

## Runtime

- Health: `GET {COMFY_URL}/system_stats` (JSON `devices` / `system`)
- Upload: `POST {COMFY_URL}/upload/image` (optional `COMFY_INPUT_DIR` copy)
- Queue: `POST {COMFY_URL}/prompt` `{ "prompt", "client_id": "ams-v2" }`
- Poll: `GET /history/{prompt_id}` every 1s, timeout 10 min
- Default URL: `http://127.0.0.1:8188`
- Hardware note: workflows built on RTX 5070 Ti; **16 GB VRAM recommended**
