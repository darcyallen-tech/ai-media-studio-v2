# AIMS music workflows (ACE Step 1.5 + MiniMax Music 3)

Built 2026-09-15. Load from `workflows/comfy/`.

## Why tracks often sounded wrong
1. **Duration mismatch** â€” tags said "~30 seconds" but `duration` / empty latent were **140s** (old Gymdesk ACE graph).
2. **Wrong timesignature** â€” hard rock on `6` instead of `4`.
3. **Turbo vs XL CLIP pair** â€” turbo needs `qwen_0.6b` + `qwen_1.7b`; XL needs `0.6b` + `4b`.
4. **CFG on turbo** â€” keep KSampler **cfg=1**; use encoder `cfg_scale` (~2) for ACE guidance.
5. **Lyrics format** â€” ACE wants `[Verse]` / `[Chorus]` sections; leave **lyrics empty** for instrumental.
6. **Tags** â€” short comma tags + matching BPM beat the long prose dump.

## Workflows

| File | Binding | Defaults |
|------|---------|----------|
| `ACE STEP 1.5 TURBO SONG.json` | `ace_turbo_song` | 30s, 8 steps, cfg 1, euler + linear_quadratic, AuraFlow shift 3 |
| `ACE STEP 1.5 TURBO INSTRUMENTAL.json` | `ace_turbo_instrumental` | 30s instrumental hard-rock cue, empty lyrics |
| `ACE STEP 1.5 XL QUALITY SONG.json` | `ace_xl_song` | 60s, 50 steps, cfg 6, dual CLIP 0.6+4b |
| `MINIMAX MUSIC 3 SONG.json` | `minimax_music3_song` | 60s max, 30 steps, cfg 1.7, euler/simple |
| `MINIMAX MUSIC 3 TURBO.json` | `minimax_music3_turbo` | + 8-step turbo LoRA, 8 steps |

**Rule:** when you change length, set ACE `duration` **and** Empty Latent `seconds` to the **same** number (and mention it in tags). MiniMax links latent seconds from the encode node automatically.

## Models on disk (OK)
- ACE: `acestep_v1.5_turbo`, `acestep_v1.5_xl_base_bf16`, `ace_1.5_vae`, `qwen_0.6b/1.7b/4b_ace15`
- MiniMax Music 3: `minimax_music3_dit_fp16`, `minimax_music3_text_encoder_pruned_int8_convrot`, `minimax_music3_dav`, `minimax_music3_turbo_lora_8step`

## Optional downloads
See `MISSING_MUSIC_MODELS.md`.


## Output format
Primary save is **WAV** via `SaveModernAudio` (AIMS custom node in `custom_nodes/aims_audio_utils`). Sample rate is taken from the decoded AUDIO (ACE 1.5 = 48 kHz, MiniMax Music 3 = 44.1 kHz). Set `also_mp3` true on that node if you ever want a side MP3.

## SaveModernAudio / TorchCodec
On newer torchaudio, 	orchaudio.save routes through TorchCodec. AIMS SaveModernAudio writes WAV with stdlib wave instead — no pip install torchcodec required. Restart Comfy after updating custom_nodes/aims_audio_utils.

## Duration = one control
- **ACE:** use the **Duration (seconds)** node (`aims_audio_utils`). It feeds both Tags/Lyrics `duration` and Empty Latent `seconds`. Do not set those two by hand anymore.
- **MiniMax:** already linked — Empty Latent `seconds` comes from Caption and Lyrics output. Change **max_duration** only.

## Rock LoRA workflows
See `ACE_ROCK_LORAS.md`. Bindings: `ace_xl_rock`, `ace_turbo_rock`, `ace_xl_rock_stack`.

