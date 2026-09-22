# MiniMax H3 Workflows (AIMS / ComfyUI API)

Target: `C:\Users\Darcy\ai-media-studio-v2\workflows\comfy\` on DESKTOP-NJUJJF9  
(machineId `aa5e6559-6ca7-4a65-89ed-e6445e66246d`).

**VRAM:** RTX 5070 Ti ~16 GB — prefer int8_convrot DiTs + Lightning for drafts.

## Model filenames (exact)

| Role | Folder | Filename |
|------|--------|----------|
| DiT FL2VA (T2V/I2V/FL2V/Fun/Camera) | `diffusion_models` | `MiniMax_H3_FL2VA_pruned_int8_convrot.safetensors` |
| DiT Ref2VA (R2V) | `diffusion_models` | `minimax_h3_ref2va_pruned_int8_convrot.safetensors` |
| CLIP | `text_encoders` | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` (type `minimax`) |
| Video VAE | `vae` | `minimax_h3_video_vae_fp16.safetensors` |
| Audio VAE | `vae` | `minimax_h3_audio_vae_fp32.safetensors` |
| FL2V turbo 4-step | `loras` | `minimax_h3_fl2v_turbo_4step_v1.2_768p_comfyui_bf16.safetensors` |
| FL2V turbo 8-step | `loras` | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` |
| Ref2V turbo 4-step | `loras` | `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` |
| Fun ControlNet Union | `model_patches` | `minimax_h3_fun_controlnet_union_pruned_int8_convrot.safetensors` |

No Ref2V **8-step** LoRA on Comfy-Org/MiniMax-H3 (only 4-step). R2V therefore ignores **Use 8-step turbo** and stays on 4-step when Lightning is on.

## Sampling matrix

| Mode | Steps | Sampler | SigmaShift video/audio | LoRA |
|------|-------|---------|------------------------|------|
| Quality (Lightning off) | 20 | `res_multistep` | 12 / 3 | none |
| Lightning + Use 8-step false | 4 | `euler` | 6 / 3 | FL2V/Ref 4-step @ 1.0 |
| Lightning + Use 8-step true | 8 | `euler` | 6 / 3 | FL2V 8-step @ 1.0 (FL graphs only) |

- Nested `ComfySwitchNode`: outer = Lightning Enable; inner (FL graphs) = Use 8-step turbo.
- `MiniMaxH3SigmaShift` after model path (and after Fun ControlNet Apply when present).
- `BasicScheduler` + `BasicGuider` both use the **shifted** model.
- `easy cleanGpuUsed` before both VAE decodes.
- `ComfyMathExpression` length uses **`values.a`** (Autogrow), not legacy `a`.
- FPS 24; length grid 17k+5 via duration seconds.

## Resolution

`MiniMaxH3Resolutions` (custom pack **ComfyUI-WanResolutions** / boobkake22):

- Default: `aspect_ratio` = `16:9`, `resolution` = `High Detail (1.00 MP) — 1344×768`
- Requires pack installed under `custom_nodes/ComfyUI-WanResolutions` + Comfy restart if newly cloned.

## Graphs

| File | Binding key | Notes |
|------|-------------|-------|
| `Minimax H3 T2V.json` | `minimax_h3_t2v` | FL2VA, no frames |
| `Minimax H3 I2V.json` | `minimax_h3_i2v` | + FIRST_FRAME |
| `Minimax H3 FL2V.json` | `minimax_h3_fl2v` | + FIRST + LAST |
| `Minimax H3 Reference 2 Video.json` | `minimax_h3_r2v` | Ref2VA; Use 8-step present but ignored |
| `Minimax H3 I2V Fun Control.json` | `minimax_h3_i2v_fun_control` | primary Fun Control |
| `Minimax H3 T2V Fun Control.json` | `minimax_h3_t2v_fun_control` | no first_frame |
| `Minimax H3 T2V Camera.json` | `minimax_h3_t2v_camera` | camera_prompt paste + concat |

### Fun Control wiring

`UNET → Lightning/8-step switches → MiniMaxH3FunControlNetApply(model, model_patch, vae=video VAE, strength≈0.85, start=0, end=0.75, control_video) → MiniMaxH3SigmaShift → sample/decode`.

- `ModelPatchLoader` name: `minimax_h3_fun_controlnet_union_pruned_int8_convrot.safetensors` in `D:\ComfyUI\models\model_patches\` (or Comfy models root).
- CONTROL_VIDEO is `LoadImage` (image batch = frames). Strength/start/end are PrimitiveFloat widgets.

### Camera

See `Minimax H3 T2V Camera.md`. Pack: `NyckM/3d-Camera-control-H3-Minimax` →  
`C:\Users\Darcy\ComfyUI-Installs\ComfyUI\ComfyUI\custom_nodes\3d-Camera-control-H3-Minimax`.  
**Comfy restart required** before `H3LocalCameraEditor` appears in object_info. AIMS graph uses paste-in `camera_prompt` + `StringConcatenate` (does not embed the UI-heavy Camera node).

## Custom nodes / restart checklist

1. **ComfyUI-WanResolutions** — `MiniMaxH3Resolutions`
2. **ComfyUI-Easy-Use** — `easy cleanGpuUsed`
3. **3d-Camera-control-H3-Minimax** — optional for generating camera_prompt text; AIMS graph works without it if user pastes
4. Core Comfy ≥ ~0.30 for native MiniMax H3 + Fun ControlNet Apply; Fun ControlNet Apply needs relatively recent core (docs say ≥0.35 for the official Fun template)

Restart Comfy after installing packs before validating object_info.

## Soft-validate

Against `http://127.0.0.1:8188/object_info` on the PC (after restart):

```powershell
python -c "import json,urllib.request; o=json.load(urllib.request.urlopen('http://127.0.0.1:8188/object_info')); need=['MiniMaxH3Resolutions','MiniMaxH3FunControlNetApply','ModelPatchLoader','StringConcatenate','easy cleanGpuUsed','H3LocalCameraEditor']; print({k:(k in o) for k in need})"
```

## Action Pose (subject motion)
- `Minimax H3 Action Pose Fun Control.json` / `... R2V.json` � see `H3_ACTION_POSE.md`. DWPose + Fun Control defaults strength 0.75 / end 0.70.

