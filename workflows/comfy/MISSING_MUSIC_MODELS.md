# Missing / optional music models (updated 2026-09-15)

## You already have (no download needed)
ACE Step 1.5 turbo + XL base + **XL turbo**, ACE VAE, ACE dual CLIPs (0.6 / 1.7 / 4b), ACE Step v1 3.5b checkpoint.
MiniMax Music 3 DiT + int8 text encoder + DAV VAE + 8-step turbo LoRA.

## Optional (genre / polish)
1. ~~ACE Step 1.5 XL Turbo~~ — **installed** as `diffusion_models/acestep_v1.5_xl_turbo_bf16.safetensors` (pair with `qwen_0.6b_ace15` + `qwen_4b_ace15`).
2. **ACE rock/metal LoRAs** (community XL LoRAs) — attach with `LoraLoaderModelOnly` after UNET; XL LoRA only on XL ckpt.
   - Search: https://huggingface.co/models?search=ACE-Step%20LoRA%20rock
   - Strength ~0.8–1.0; put rock trigger tags first in the tags field.

Nothing required for the five AIMS music workflows to load.
