# AI Media Studio V2 — How to

Start from a zip on Windows. You pay fal / xAI / Runware for usage. This app is free.

Keys never belong in this file. Paste them only in Settings.

---

## 1. Unzip and run

1. Unzip the folder so you can see `AIMediaStudioV2.exe`, `_internal\`, and `AMS_V2.bat`.
2. Double-click **AIMediaStudioV2.exe** (or **AMS_V2.bat**). Keep `_internal` next to the exe.
3. A window titled **AI Media Studio V2** should open in a few seconds.

**WebView2.** The desktop window uses Microsoft Edge WebView2. Windows 10/11 usually already have it. If the window fails and a browser tab opens instead (or nothing does), install the Evergreen Runtime:

https://developer.microsoft.com/microsoft-edge/webview2/

Then run the exe again.

The app listens on `http://127.0.0.1:8000`. If 8000 is busy it tries **8001** and still opens a window. If both are busy it exits — close the other Studio window and try again.

Files you generate go here (not inside the zip):

`%LOCALAPPDATA%\AI Media Studio V2\outputs`

On most PCs that is `C:\Users\<you>\AppData\Local\AI Media Studio V2\outputs`.

---

## 2. Settings → keys

Open **Settings** (top of the app).

Under **API keys**, paste one or more, then **Save keys**. The field shows `(not set)` or a last-4 mask. Stored only in `%LOCALAPPDATA%\AI Media Studio V2\secrets.json`.

| Key | Need it for | Get a key |
|-----|-------------|-----------|
| **fal** | Almost all stills, video, audio, Tools | [fal dashboard](https://fal.ai/dashboard/keys) |
| **xAI** (optional) | Prompt Enhance / Grok text. Imagine models still use fal. | [xAI API keys](https://console.x.ai/team/default/api-keys) |
| **Runware** (optional) | Frame Editor / Aleph only | [Runware keys](https://my.runware.ai/keys) |

Each row has a **dashboard** link. Billing links are under the balance lines in Settings.

You can use the app with **fal only**. Add Runware when you want Frame Editor. Add xAI when you want Enhance.

---

## 3. First still (T2I)

1. Mode: **Image**.
2. Model: something cheap to start, e.g. **Flux 2 (T2I · cheaper)**.
3. Type a prompt (a listing kitchen, a product, a title card).
4. Check **Est. cost** under the prompt. Generate.

The still appears on a Result node and in **Library**. Disk path:

`%LOCALAPPDATA%\AI Media Studio V2\outputs\YYYY-MM-DD\`

Settings → paths can open the outputs folder.

---

## 4. Edit a still (I2I)

1. Stay on **Image**. Pick an **edit** model (default is Flux 2 Pro edit).
2. Put a still on **Source**:
   - drag from **Library**, or
   - import a file into Library (image/video/audio picker), then drag it on.
3. Prompt what should change. Generate.

Need extra refs (a logo, a material)? Use an R2I model and drop extra stills on the ref slots.

For a boxed / painted local edit, pick **Fibo Edit** or **Seedream 5 Pro (edit)** and click **Add Mask** on the Prompt node. Draw boxes or paint on the MASK node — there is no Region tab.

---

## 5. Simple image-to-video

1. Mode: **Video**.
2. Pick an **Image-to-Video** model (Kling O3 Standard I2V is a reasonable first try).
3. Drop a start still on **Source** (Library or disk via Library).
4. Optional: **Last Frame** if that model shows the chip (Kling 3.0 / O3, Seedance 2.5, H3, LTX 2.5).
5. Set duration / aspect / audio if shown. Read Est. cost. Generate.

The clip lands in the same dated outputs folder and in Library (Video filter).

---

## 6. Frame Editor (Aleph / Runware)

Needs a **Runware** key. If it is missing, the Frame node tells you to open Settings.

1. Mode: **Frame**. Model is **Aleph 2.0 (Runware)**.
2. Drop a clip on the source (about 2–30 seconds; longer clips are prepared and trimmed).
3. Play, **pin** a frame (up to 5).
4. Edit that pin (still edit), apply it back onto the pin.
5. Generate. Output length follows the source (2–30 s).

This path is Runware-only. Fal video models do not replace it.

---

## 7. Storyboard lite (2–3 shots)

1. Mode: **Storyboard**.
2. Add an **Asset Hub**. Add a character or scene still if you have one (Assets panel or Library).
3. Add **2 or 3 Shots**. Short action + camera on each. Keep the duration budget in range.
4. Model:
   - **Kling 3.0 Standard or Pro I2V/T2V** if you want native multi-shot (`multi_prompt`) and, on I2V, the Elements tray (`@Element1` …).
   - Otherwise the default **MiniMax H3 Omni** flattens the board into one reference-to-video job.
5. Generate once. Shots share the hub.

Last frame is not sent from Storyboard. Use Video I2V / Bridge for first→last.

---

## 8. Library

Open the **Library** side panel.

- Filters: All / Image / Video / Audio / **From Resolve**.
- Drag a row onto Source, Last Frame, a Tool, a pin, or a shot.
- Result nodes also **Send to Resolve** when you want the file in Resolve’s Media Pool.

Reuse the same kitchen still for I2I, then I2V, without hunting the folder.

---

## 9. Optional: DaVinci Resolve

Not required.

**Receive (From Resolve)**

1. Settings → **Resolve inbox (optional)**. Point it at the folder your Resolve script writes to.
2. Library → **From Resolve** → **Refresh From Resolve**.

If inbox is empty, `/resolve/status` will say no inbox is set. The packaged app does not assume a V1 install next door.

**Send**

Library row or Result node → **Send to Resolve**. Needs Resolve running with its scripting API. The file is already in outputs if send fails.

---

## If something fails

| Symptom | What to do |
|---------|------------|
| No window, or only a browser tab | Install [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/), restart the exe. |
| Second copy of the app | 8000 was busy; the new one is on **8001**. Close the extra window if you did not want two. |
| App exits immediately | 8000 **and** 8001 are in use. Close other Studio windows (or whatever bound those ports) and retry. |
| Generate blocked / “key not set” | Settings → fal (or Runware for Frame) → paste → **Save keys**. Mask should leave `(not set)`. |
| Frame Editor blocked | Runware key only. fal does not unlock Aleph. |
| Est. cost is a dash | Wrong model id or the helper could not price it. Switch model or check Settings keys. |
| Still/clip not on disk where you looked | Packaged app writes `%LOCALAPPDATA%\AI Media Studio V2\outputs\`, not the unzip folder. |
| From Resolve is empty | Set Resolve inbox in Settings, then Refresh. |

Nothing in this app phones home except the APIs behind the keys you pasted.

For what each mode and model is *for*, see `FEATURES.md`.
