import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyTheme, readStoredTheme } from "./theme";
import "./index.css";

applyTheme(readStoredTheme());

function paintCrash(err: unknown) {
  const root = document.getElementById("root");
  if (!root) return;
  const message =
    err instanceof Error
      ? `${err.message}\n\n${err.stack || ""}`
      : String(err ?? "Unknown error");
  root.innerHTML = `<pre style="margin:0;padding:24px;white-space:pre-wrap;color:#8a2020;background:#f6e8e8;min-height:100vh;font:13px/1.45 ui-monospace,monospace">${message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre>`;
}

window.addEventListener("error", (event) => {
  console.error("App error", event.error || event.message, event);
  paintCrash(event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("App unhandled rejection", event.reason);
  paintCrash(event.reason);
});

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Root render crashed", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            margin: 0,
            padding: 24,
            whiteSpace: "pre-wrap",
            color: "#8a2020",
            background: "#f6e8e8",
            minHeight: "100vh",
            font: "13px/1.45 ui-monospace, monospace",
          }}
        >
          {this.state.error.stack || this.state.error.message}
        </pre>
      );
    }
    return this.props.children;
  }
}

const el = document.getElementById("root");
if (!el) {
  throw new Error("Missing #root");
}
try {
  createRoot(el).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  paintCrash(err);
}
