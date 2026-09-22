# MODEL_INVENTORY — T2V note (2026-09-15)

## Present — T2V graphs
- `Wan 2.1 T2V 1.3B.json` + binding `wan_t2v_13b`
- `Wan 2.1 T2V 14B FP8.json` + binding `wan_t2v_14b`
- `LTX 2.5 T2V.json` + binding `ltx25_t2v`
- Docs: `T2V_WORKFLOWS.md`

## Models pinned (on disk under D:\ComfyUI\models)
- Wan: wan2.1_t2v_1.3B_fp16, wan2.1_t2v_14B_fp8_scaled, umt5_xxl_fp8_e4m3fn_scaled, wan_2.1_vae
- LTX 2.5: distilled transformer int8-convrot, gemma4-12b-with-proj int8-convrot, video-vae-**conv**-bf16, audio-vae-bf16, distill LoRA 450 bf16

## Optional / not required for lean graphs
- `latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors` — skipped in LTX lean T2V; no critical missing weights for these three graphs.
