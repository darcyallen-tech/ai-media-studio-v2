# T2V Workflows (AIMS / ComfyUI API)

Build-only artifacts for Darcy's Windows PC (`DESKTOP-NJUJJF9`). **Do not queue `/prompt` until smoke-tested.**

Target dir: `C:\Users\Darcy\ai-media-studio-v2\workflows\comfy\`  
Models root: `D:\ComfyUI\models\`  
VRAM: RTX 5070 Ti ~16 GB â€” defaults are conservative.

## Graphs

### `Wan 2.1 T2V 1.3B.json` â€” binding `wan_t2v_13b`
- **For:** fast draft T2V (Wan 2.1 1.3B).
- **Models:** `diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors`, `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`, `vae/wan_2.1_vae.safetensors`
- **Path:** UNETLoader â†’ ModelSamplingSD3(shift=8) â†’ KSampler; CLIPLoader(type=wan); EmptyHunyuanLatentVideo; VAEDecode â†’ CreateVideo(fps=16) â†’ SaveVideo
- **Defaults:** 832Ã—480, length=81, fps=16, steps=20, cfg=6, sampler=uni_pc, scheduler=simple, seed=0
- **VRAM:** ~16 GB-safe draft

### `Wan 2.1 T2V 14B FP8.json` â€” binding `wan_t2v_14b`
- **For:** higher-quality Wan T2V using on-disk fp8_scaled DiT.
- **Models:** `diffusion_models/wan2.1_t2v_14B_fp8_scaled.safetensors` (+ same UMT5 + wan_2.1_vae)
- **Defaults:** 832Ã—480, length=**49**, steps=20, cfg=**5**, same sampler stack, fps=16
- **VRAM:** more conservative length than 1.3B; still tight on 16 GB â€” shorten length further if OOM

### `LTX 2.5 T2V.json` â€” binding `ltx25_t2v` (lean, default)
- **For:** fast LTX 2.5 distilled T2V with native synced audio â€” **single stage, no latent upscale**.
- **Models:** distilled int8-convrot DiT + distill LoRA 450 + gemma4 CLIP (`ltxv`) + video-vae-**conv**-bf16 + audio-vae-bf16
- **Defaults:** 768Ã—512, length=97, fps=24, LTXVScheduler 8 steps, CFG 1.0, euler, seed=0
- **VRAM:** safest starting point on 16 GB

### `LTX 2.5 T2V Spatial Upscale.json` â€” binding `ltx25_t2v_spatial` (quality variant)
- **For:** official-style **two-stage** T2V: stage1 at 768Ã—512 â†’ **spatial Ã—2** latent upscale â†’ short stage2 refine â†’ tiled VAE decode.
- **Extra model:** `latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors`
- **Defaults:** ManualSigmas stage1 + stage2 refine; DualCFG video/audio=1; stage2 noise seed=42; output ~1536Ã—1024
- **VRAM:** much heavier than lean â€” if OOM, drop stage1 to 640Ã—384 / shorten length, or use `ltx25_t2v`

### `LTX 2.5 T2V Temporal Upscale.json` â€” binding `ltx25_t2v_temporal` (length variant)
- **For:** stage1 length=49 â†’ **temporal Ã—2** latent upscale â†’ refine (longer clip, same spatial res).
- **Extra model:** `latent_upscale_models/ltx-2.5-latent-temporal-upscaler-x2-bf16-1.0.safetensors`
- **Note:** mostly duration/temporal density, not sharpness. Prefer spatial for "looks better".

**LTX 2.3 upscalers** on disk (`ltx-2.3-spatial-upscaler-x1.5`, `x2-1.1`, `temporal-x2`) stay available for future LTX 2.3 graphs â€” not wired into these 2.5 variants.


### Wan 2.2 TI2V 5B.json — binding wan22_ti2v_5b
- **For:** Wan 2.2 hybrid 5B text-to-video (no start image). Best VRAM fit on 16 GB.
- **Models:** wan2.2_ti2v_5B_fp16 + umt5_xxl_fp8 + wan2.2_vae
- **Path:** UNET → ModelSamplingSD3(shift=5) → KSampler; Wan22ImageToVideoLatent (T2V); Clean VRAM → decode → CreateVideo
- **Defaults:** Wan Video Controls 832×480, ~5s @ 16fps, steps 20, cfg 5, uni_pc/simple

### Wan 2.2 T2V 14B.json — binding wan22_t2v_14b
- **For:** Wan 2.2 14B MoE quality T2V (high-noise then low-noise experts).
- **Models:** wan2.2_t2v_high_noise_14B_fp8_scaled + wan2.2_t2v_low_noise_14B_fp8_scaled + umt5 + wan_2.1_vae
- **Path:** dual UNET + ModelSamplingSD3(shift=8) → KSamplerAdvanced 0–10 then 10–end; Clean VRAM between stages + before decode
- **Defaults:** 832×480, ~3s @ 16fps, 20 steps, cfg 3.5, uni_pc/simple

### Wan 2.2 T2V 14B Lightning.json — binding wan22_t2v_14b_lightning
- **For:** fast 14B with lightx2v 4-step LoRAs (high/low).
- **Extra:** wan2.2_t2v_A14b_*_lora_rank64_lightx2v_4step_1217
- **Defaults:** 8 steps (switch at 4), cfg 1.0, euler/simple, shift 5


## AIMS binding keys
| Key | File | Prompt | Negative | Seed | Geometry |
|-----|------|--------|----------|------|----------|
| `wan_t2v_13b` | Wan 2.1 T2V 1.3B.json | Positive Prompt / text | Negative Prompt / text | KSampler / seed | EmptyHunyuanLatentVideo width/height/length |
| `wan_t2v_14b` | Wan 2.1 T2V 14B FP8.json | same | same | KSampler / seed | same |
| `ltx25_t2v` | LTX 2.5 T2V.json | Positive Prompt / text | Negative Prompt / text | RandomNoise / noise_seed | length + LTXVConditioning frame_rate |

## Notes
- **Comfy UI (Wan):** Wan Video Controls (AIMS) in the same ims_ltx_utils pack — snaps width/height to x16 and length to 4n+1, wires EmptyHunyuanLatentVideo + CreateVideo. Default 16 fps; 1.3B defaults ~5s (81f), 14B ~3s (49f). Restart Comfy after update.

- **Comfy UI:** `LTX Video Controls (AIMS)` custom node (`custom_nodes\aims_ltx_utils`) drives aspect/preset, seconds, and fps for all LTX 2.5 graphs — snaps width/height to x32 and length to 8n+1, and keeps Empty video/audio + conditioning + CreateVideo matched. Restart Comfy after install. 24 is not a hard FPS limit; 30 works locally, official sweet spots are 24/25/48/50.
- **VRAM:** easy cleanGpuUsed (Clean Vram Used) is wired after stage1 (spatial/temporal variants) and before VAE decode on LTX + Wan T2V graphs to drop DiT cache between heavy steps.
- GGUF DiTs stay in `unet/` (not used by these graphs; Wan/LTX DiTs are under `diffusion_models/`).
- SaveVideo format/codec = `auto` (AIMS/Minimax-style).
- Official Wan T2V uses **EmptyHunyuanLatentVideo**, not WanImageToVideo.
- EmptyLTXVLatentVideo schema: width/height step **32**, length step **8** (defaults 768/512/97).
- Build-only: no `/prompt` submissions were made while authoring.

