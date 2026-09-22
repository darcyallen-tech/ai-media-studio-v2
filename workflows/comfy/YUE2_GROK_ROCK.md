# YuE2 Grok Rock (test)

**File:** YuE2 TEXT TO MUSIC GROK ROCK.json  
**Checkpoint:** yue2_3b_bf16.safetensors (you have this; template defaulted to int8)

## Graph
Checkpoint → YuE2 Generate ABC (ull) → YuE2 Generate Music → Empty latent (auto seconds) → KSampler (32 / cfg 1 / dpm_2 / sgm_uniform) → VAEDecodeAudio → WAV

## Default song
Hard-rock banger about **Grok the Bot** (style + lyrics already filled).

## Notes
- First run can be slow (planning + synthesis).
- bf16 on 16GB may be tight; if OOM, grab yue2_3b_int8_convrot and swap the checkpoint name.
- SheetSage2 is only needed for covers, not this text-to-music test.
- AIMS key: yue2_grok_rock
