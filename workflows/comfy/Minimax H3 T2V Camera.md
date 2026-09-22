# MiniMax H3 Camera workflows

## Visual editor
On-canvas node: **bruxosdovfx • Camera H3** (BruxosH3Camera).

Open/select that node — the 3D keyframe panel is its web UI. Drag the camera, use orbit/rise/push presets in the panel, then run.

H3 Camera Move Preset seeds camera_trajectory (dropdown). The visual panel can override it.

minimax_prompt from Camera H3 is concatenated with your scene prompt. length + ps come from the Camera profile (124 / 243 / 362 frames @ 24fps).

## Which modes
| Graph | Mode | Notes |
|-------|------|-------|
| Minimax H3 T2V Camera.json | T2V | Text + camera path |
| Minimax H3 I2V Camera.json | I2V | First frame also feeds Camera 
eference_image (best UX) |
| Minimax H3 R2V Camera.json | R2V | Refs for identity; Camera panel uses REF_IMAGE_1 as reference |

Works on all three because Camera H3 outputs prompt text (+ length/fps), not a separate model.

## Restart
Restart Comfy once if H3CameraMovePreset is missing after install.
