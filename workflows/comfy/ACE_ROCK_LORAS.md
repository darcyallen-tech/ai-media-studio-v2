# ACE Step rock LoRAs (local)

## Files in `D:\ComfyUI\models\loras`
| File | Base | Trigger |
|------|------|---------|
| `rock-xl-v1.safetensors` | XL | `roti-r0kkk` |
| `rock-v1.safetensors` | Turbo 2B | `roti-r0kkk` |
| `indie_rock-xl-v1.safetensors` | XL | `roti-1ndr0k` |
| `progressive_rock-xl-v1.safetensors` | XL | `roti-prgr0k` |
| `psychedelic_rock-xl-v1.safetensors` | XL | `roti-psych-r0kk` |
| `punk-xl-v1.safetensors` | XL | `roti-punkkk` |
| `grunge-xl-v1.safetensors` | XL | `roti-grungg` |
| `metal-xl-v1.safetensors` | XL | `roti-m3t4al` |

## Workflows
- `ACE STEP 1.5 XL ROCK LORA SONG.json` → binding `ace_xl_rock`
- `ACE STEP 1.5 TURBO ROCK LORA SONG.json` → binding `ace_turbo_rock`
- `ACE STEP 1.5 XL ROCK STACK DEMO.json` → binding `ace_xl_rock_stack` (rock + indie_rock example)

## Combining LoRAs
Yes — chain `LoraLoaderModelOnly` nodes (UNET → LoRA1 → LoRA2 → AuraFlow). Put **both triggers** in tags. Start strengths ~0.7–1.0 primary / ~0.4–0.6 secondary. Closely related genres (rock + indie / rock + metal) work better than distant fusions. There is **no Peruvian/Andean folk ACE LoRA** in the common packs today; a “folk + hard rock” blend like the old Suno Guardian Peru tracks would need a custom-trained folk LoRA (or strong tags only), and stacking alone rarely matches a true fusion model.
