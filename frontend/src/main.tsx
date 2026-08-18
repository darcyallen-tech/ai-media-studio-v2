import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener("error", (event) => {
  console.error("App error", event.error || event.message, event);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("App unhandled rejection", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
