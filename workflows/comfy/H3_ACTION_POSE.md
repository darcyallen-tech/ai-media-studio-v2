# MiniMax H3 Action Pose Fun Control

For **subject action** (walks, swings, gestures). Use Camera H3 Freeze graphs for camera showpieces instead.

## Graphs
| File | Binding | Role |
|------|---------|------|
| Minimax H3 Action Pose Fun Control.json | minimax_h3_action_pose | I2V: first frame identity + DWPose from action plate |
| Minimax H3 Action Pose Fun Control R2V.json | minimax_h3_action_pose_r2v | R2V: identity sheet ref + same pose control (stronger identity) |

## Pipeline
1. ACTION_PLATE path (mp4) — short clip of the motion (ideally subject large in frame, ~3–5s @ 24fps)
2. DWPose extracts body(+hands) stick figures
3. MiniMaxH3FunControlNetApply — strength **0.75**, start **0**, end **0.70**
4. First frame / Ref image locks appearance
5. Prompt: one clear action; minimal camera language

## Tips
- Pose > depth for limbs. Subject should fill more of the frame.
- Match plate length to duration (124 frames ≈ 5s). Cap load at 124 by default.
- Start with Lightning off for action tests; Lightning is fine for drafts.
- Don’t combine this with a big Camera H3 orbit in the same shot.
- If stick-figure artifacts show, lower strength toward 0.6 or end toward 0.6.

## Models
- FL2VA or Ref2VA int8 DiTs (as wired)
- Fun ControlNet: minimax_h3_fun_controlnet_union_pruned_int8_convrot.safetensors
- Needs ComfyUI ControlNet Aux (DWPreprocessor) + Video Helper Suite (VHS_LoadVideoPath)
