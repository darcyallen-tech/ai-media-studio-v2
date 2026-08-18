import { useState } from "react";
import "./App.css";

type Mode = "image" | "video" | "audio";

const MODES: { id: Mode; label: string }[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
];

export default function App() {
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");

  return (
    <main className="shell">
      <header className="header">
        <h1>AI Media Studio V2</h1>
        <p className="lede">V2 shell — Prompt → Generate coming soon</p>
      </header>

      <section className="panel">
        <div className="pills" role="tablist" aria-label="Mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? "pill on" : "pill"}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="prompt-label" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="prompt"
          rows={8}
          placeholder="Describe the still, clip, or track…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <button type="button" className="generate" disabled>
          Generate
        </button>
      </section>
    </main>
  );
}
