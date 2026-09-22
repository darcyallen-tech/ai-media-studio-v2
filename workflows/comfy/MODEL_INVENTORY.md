# Local ComfyUI model inventory (Darcy) — 2026-09-15

**Root:** `D:\ComfyUI\models\`

## Moves this session
| File | From | To |
|------|------|----|
| `acestep_v1.5_xl_turbo_bf16.safetensors` | `Downloads\` | `diffusion_models\` |
| `wan2.1_i2v_720p_14B_fp8_scaled.safetensors` | `Downloads\` | `diffusion_models\` |

Already correct (no move): ACE XL base, ACE turbo, Wan T2V 1.3B, Wan I2V 480p, Wan/ACE VAEs + ACE CLIPs.

## ACE Step 1.5
| File | Folder |
|------|--------|
| `acestep_v1.5_turbo.safetensors` | `diffusion_models/` |
| `acestep_v1.5_xl_base_bf16.safetensors` | `diffusion_models/` |
| `acestep_v1.5_xl_turbo_bf16.safetensors` | `diffusion_models/` |
| `qwen_0.6b_ace15.safetensors` | `text_encoders/` |
| `qwen_1.7b_ace15.safetensors` | `text_encoders/` |
| `qwen_4b_ace15.safetensors` | `text_encoders/` |
| `ace_1.5_vae.safetensors` | `vae/` |
| `ace_step_v1_3.5b.safetensors` | `checkpoints/` (legacy v1) |

## Wan 2.1
| File | Folder | Notes |
|------|--------|-------|
| `wan2.1_t2v_1.3B_fp16.safetensors` | `diffusion_models/` | Light T2V |
| `wan2.1_i2v_480p_14B_fp8_scaled.safetensors` | `diffusion_models/` | Best fit for ~16 GB |
| `wan2.1_i2v_720p_14B_fp8_scaled.safetensors` | `diffusion_models/` | Heavier; use when VRAM allows |
| `wan_2.1_vae.safetensors` | `vae/` | |
| `umt5_xxl_fp8_e4m3fn_scaled.safetensors` | `text_encoders/` | |
| `clip_vision_h_fp16.safetensors` / `clip_vision_vit_h.safetensors` / `clip_vision_g.safetensors` | `clip_vision/` | |

## Diffusion UNETs also present
`krea2_turbo_*`, LTX 2.3/2.5 distilled, MiniMax H3 ref2va, MiniMax Music 3 DiT, Qwen Image 2512 + Edit 2511 int8, Z-Image turbo/base variants.

See also: `INSTALL_MANIFEST.md`, `MUSIC_WORKFLOWS.md`.


# MODEL_INVENTORY â€” T2V note (2026-09-15)

## Present â€” T2V graphs
- `Wan 2.1 T2V 1.3B.json` + binding `wan_t2v_13b`
- `Wan 2.1 T2V 14B FP8.json` + binding `wan_t2v_14b`
- `LTX 2.5 T2V.json` + binding `ltx25_t2v`
- Docs: `T2V_WORKFLOWS.md`

## Models pinned (on disk under D:\ComfyUI\models)
- Wan: wan2.1_t2v_1.3B_fp16, wan2.1_t2v_14B_fp8_scaled, umt5_xxl_fp8_e4m3fn_scaled, wan_2.1_vae
- LTX 2.5: distilled transformer int8-convrot, gemma4-12b-with-proj int8-convrot, video-vae-**conv**-bf16, audio-vae-bf16, distill LoRA 450 bf16

## Optional / not required for lean graphs
- `latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors` â€” skipped in LTX lean T2V; no critical missing weights for these three graphs.

