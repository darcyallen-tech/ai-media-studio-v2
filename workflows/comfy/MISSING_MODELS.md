# AIMS Comfy pack — missing / nice-to-have models (updated 2026-09-15)

## Have (used by new workflows)
- qwen_image_edit_2511_int8_convrot + Edit Lightning 4-step + multiple-angles + skin LoRA
- flux-2-klein-9b_int8_convrot + qwen_3_8b_fp8mixed + flux2-vae (if present in loaders)
- zimageTurboByStable_2602BF16 + qwen_3_4b + ae + Radiant LoRA
- krea2_turbo_int8_convrot + qwen3vl_4b_fp8_scaled + qwen_image_vae (+ darkbrush / style_reference LoRAs)
- **Wan 2.1 diffusion** — `wan2.1_t2v_1.3B_fp16`, `wan2.1_i2v_480p_14B_fp8_scaled`, `wan2.1_i2v_720p_14B_fp8_scaled` in `diffusion_models/` + `wan_2.1_vae` + `umt5_xxl_fp8_e4m3fn_scaled` + clip_vision packs

## Missing (recommended)
1. ~~Wan diffusion weights~~ — **done** (see above). Prefer **480p** I2V on 16 GB; 720p is heavy.
2. **Flux Kontext Dev** (optional) — classic Kontext multi-ref beside Klein enhancer. Not required for Klein multi-R2I.
3. **IP-Adapter packs for SDXL/Juggernaut** — only if you want that multi-ref path; `clip_vision` already has ViT-H / G.

## Optional upgrades
- Full bf16 `flux-2-klein-9b.safetensors` (you run int8 — fine for 16 GB)
- Qwen Edit non-int8 if you want max quality and can spare VRAM
- ControlNets for Krea2 depth if you do guided sheet poses
