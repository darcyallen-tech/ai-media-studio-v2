# AIMS Comfy — install manifest (draft)

Easy model + custom-node checklist for the AIMS V2 local Comfy pack under `workflows/comfy/`.
Pin exact filenames the graphs already reference. Prefer Comfy-Org split packs over upstream Diffusers trees.

**Your model root (Darcy):** `D:\ComfyUI\models\`  
**Comfy install:** `C:\Users\Darcy\ComfyUI-Installs\ComfyUI\ComfyUI\`  
**Shared I/O:** `C:\Users\Darcy\ComfyUI-Shared\input` / `output`

If a user’s Comfy uses the default tree, the same relative folders apply under `ComfyUI/models/`.

---

## 0. Custom nodes (install once)

| Need | Pack / install | Used by |
|------|----------------|---------|
| **Save Audio (AIMS WAV)** | Bundle `aims_audio_utils` into `custom_nodes/` (ships with AIMS; not on Nodes Manager). Optional later: GitHub mirror for Comfy-only users. | All music workflows (`SaveModernAudio`) |
| **LayerStyle** | ComfyUI Manager → `ComfyUI_LayerStyle` (or [chflame163/ComfyUI_LayerStyle](https://github.com/chflame163/ComfyUI_LayerStyle)) | Qwen / Klein R2I preprocess (`LayerUtility: ImageScaleByAspectRatio V2`) |
| **ResolutionSelector** | Manager → `Comfyui-Resolution-Master` (or matching ResolutionSelector pack) | Most image T2I / R2I |
| **Qwen Multiangle** | Manager → `comfyui-qwenmultiangle` | `qwen_angle` |
| **Flux.2 Klein Enhancer** | Manager → `ComfyUI-Flux2Klein-Enhancer` | Klein multi / 1ref / T2I |
| **SeedVR2** | Manager → `seedvr2_videoupscaler` | `seedvr_confirm` |
| **ComfyMath / Essentials** (optional) | Manager if graphs show missing math nodes | A few utility graphs |

Stock Comfy nodes cover ACE / MiniMax Music loaders + encode / decode once core is recent enough (0.35+).

**WAV saver note (2026-09-15):** `SaveModernAudio` no longer uses `torchaudio.save` (that path needs TorchCodec on new torchaudio). WAV is written with stdlib `wave`. **Restart Comfy** after updating `aims_audio_utils`.

**Lean alternate:** if you refuse a custom audio node, use stock **Save Audio (Advanced)** → FLAC. AIMS prefers WAV.

---

## 1. Music — ACE Step 1.5

**Hub:** [Comfy-Org/ace_step_1.5_ComfyUI_files](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files) → `split_files/`

| File | Put in | Bindings |
|------|--------|----------|
| `acestep_v1.5_turbo.safetensors` | `diffusion_models/` | `ace_turbo_song`, `ace_turbo_instrumental` |
| `acestep_v1.5_xl_base_bf16.safetensors` | `diffusion_models/` | `ace_xl_song` |
| `qwen_0.6b_ace15.safetensors` | `text_encoders/` | all ACE |
| `qwen_1.7b_ace15.safetensors` | `text_encoders/` | turbo only |
| `qwen_4b_ace15.safetensors` | `text_encoders/` | XL only |
| `ace_1.5_vae.safetensors` | `vae/` | all ACE |

Direct resolve examples:

- https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/diffusion_models/acestep_v1.5_turbo.safetensors
- https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/split_files/vae/ace_1.5_vae.safetensors

**Installed:** `acestep_v1.5_xl_turbo_bf16.safetensors` in `diffusion_models/` (XL turbo path ready).

---

## 2. Music — MiniMax Music 3

**Hub:** [Comfy-Org/MiniMax-Music-3](https://huggingface.co/Comfy-Org/MiniMax-Music-3)  
**Docs:** https://docs.comfy.org/tutorials/audio/minimax/minimax-music-3

Do **not** use the upstream MiniMaxAI Diffusers layout for Comfy.

| File | Put in | Bindings |
|------|--------|----------|
| `minimax_music3_dit_fp16.safetensors` | `diffusion_models/` | `minimax_music3_song`, `minimax_music3_turbo` |
| `minimax_music3_text_encoder_pruned_int8_convrot.safetensors` | `text_encoders/` | both |
| `minimax_music3_dav.safetensors` | `vae/` | both |
| `minimax_music3_turbo_lora_8step.safetensors` | `loras/` | turbo only |

Low-VRAM DiT alternate (swap UNET widget): `minimax_music3_dit_int8_convrot.safetensors` → same folder.

---

## 3. Image — Qwen Image Edit 2511 / Image 2512

Typical Comfy-Org / community int8 packs (filenames must match exactly):

| File | Put in | Bindings |
|------|--------|----------|
| `qwen_image_edit_2511_int8_convrot.safetensors` | `diffusion_models/` | all Qwen R2I / angles |
| `qwen_image_2512_int8_convrot.safetensors` | `diffusion_models/` | Qwen T2I |
| `qwen_2.5_vl_7b_fp8_scaled.safetensors` | `text_encoders/` | Qwen image family |
| `qwen_image_vae.safetensors` | `vae/` | Qwen + Krea2 |
| `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` | `loras/` | Lightning R2I |
| `Qwen-Image-Lightning-4steps-V1.0.safetensors` | `loras/` | Qwen T2I |
| `qwen-image-edit-2511-multiple-angles-lora.safetensors` | `loras/` | `qwen_angle` |
| `qwen-edit-skin_1.1_000002750.safetensors` | `loras/` | `qwen_multi_r2i_skin` |

INT8 Edit UNET mirror example: [Winnougan/Qwen-Image-INT8](https://huggingface.co/Winnougan/Qwen-Image-INT8) (`qwen_image_edit_2511_int8_convrot.safetensors`). Prefer official Comfy-Org Qwen packs when available.

---

## 4. Image — FLUX.2 Klein

| File | Put in | Bindings |
|------|--------|----------|
| `flux-2-klein-9b_int8_convrot.safetensors` | `diffusion_models/` | klein multi / 1ref / T2I |
| `qwen_3_8b_fp8mixed.safetensors` | `text_encoders/` | all Klein |
| `flux2-vae.safetensors` | `vae/` | all Klein |

Needs **ComfyUI-Flux2Klein-Enhancer** custom nodes.

---

## 5. Image — Z-Image / Krea2 sheet fronts

| File | Put in | Bindings |
|------|--------|----------|
| `zimageTurboByStable_2602BF16.safetensors` | `diffusion_models/` | `zimage_t2i`, `zimage_sheet_front` |
| `qwen_3_4b.safetensors` | `text_encoders/` | Z-Image |
| `ae.safetensors` | `vae/` | Z-Image (Flux-style AE) |
| `Z-Image Turbo Radiant v2.0.safetensors` | `loras/` | sheet front |
| `krea2_turbo_int8_convrot.safetensors` | `diffusion_models/` | `krea2_sheet_front` |
| `qwen3vl_4b_fp8_scaled.safetensors` | `text_encoders/` | Krea2 |
| `krea2_darkbrush.safetensors` | `loras/` | Krea2 sheet |
| `krea2_style_reference.safetensors` | (style / model pack folder per template) | optional style-ref templates |

---

## 6. Video / upscale (optional lanes)

| File | Put in | Binding |
|------|--------|---------|
| `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | `diffusion_models/` | H3 R2V |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `text_encoders/` | H3 |
| `minimax_h3_video_vae_fp16.safetensors` | `vae/` | H3 |
| `minimax_h3_audio_vae_fp32.safetensors` | `vae/` | H3 |
| `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | `loras/` | H3 turbo |
| `seedvr2_ema_7b_fp8_e4m3fn_mixed_block35_fp16.safetensors` | `SEEDVR2/` (or SeedVR2 loader path) | `seedvr_confirm` |
| `ema_vae_fp16.safetensors` | SeedVR2 VAE path | `seedvr_confirm` |

Wan diffusion still missing if you want Wan I2V — you only have `wan_2.1_vae.safetensors`. See `MISSING_MODELS.md`.

---

## 7. Suggested download order (new machine)

1. Custom nodes: LayerStyle, Resolution Master, Klein Enhancer, qwenmultiangle, copy `aims_audio_utils`.
2. Music stack (ACE turbo + MiniMax) if shipping audio first.
3. Qwen Edit 2511 int8 + Lightning + VAE + CLIP.
4. Klein int8 + VAE + CLIP.
5. Z-Image / Krea2 as needed.
6. SeedVR2 / H3 only if those bindings are enabled in product.

---

## 8. Future: one-click installer shape

Draft product shape (not built yet):

1. `install_manifest.json` next to `bindings.json` — per binding: `{models:[{file,folder,url,sha256?}], nodes:[...]}`.
2. AIMS UI “Install models for this workflow” → open HF resolve links + show target folder, or run `huggingface-cli download` into `D:\ComfyUI\models\...`.
3. Ship `aims_audio_utils` inside the AIMS installer (and optionally as a public GitHub custom node).

Until that lands, this markdown + the two `MISSING_*.md` files are the installer.

---

## 9. Related docs

- `MUSIC_WORKFLOWS.md` — ACE / MiniMax defaults and duration rules
- `MISSING_MUSIC_MODELS.md` — optional ACE XL turbo / genre LoRAs
- `MISSING_MODELS.md` — Wan / IP-Adapter / Kontext notes
- `bindings.json` — AIMS API field map

## Wan 2.1 (local — updated 2026-09-15)

| File | Put in |
|------|--------|
| `wan2.1_t2v_1.3B_fp16.safetensors` | `diffusion_models/` |
| `wan2.1_i2v_480p_14B_fp8_scaled.safetensors` | `diffusion_models/` |
| `wan2.1_i2v_720p_14B_fp8_scaled.safetensors` | `diffusion_models/` |
| `wan_2.1_vae.safetensors` | `vae/` |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `text_encoders/` |

