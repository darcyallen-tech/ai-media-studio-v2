import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/health": "http://127.0.0.1:8000",
      "/models": "http://127.0.0.1:8000",
      "/generate": "http://127.0.0.1:8000",
      "/estimate": "http://127.0.0.1:8000",
      "/outputs": "http://127.0.0.1:8000",
      "/library": "http://127.0.0.1:8000",
      "/resolve": "http://127.0.0.1:8000",
      "/enhance": "http://127.0.0.1:8000",
      "/characters": "http://127.0.0.1:8000",
      "/scenes": "http://127.0.0.1:8000",
      "/tools": "http://127.0.0.1:8000",
      "/settings": "http://127.0.0.1:8000",
      "/frame": "http://127.0.0.1:8000",
      "/extract-frame": "http://127.0.0.1:8000",
      "/prepare-aleph": "http://127.0.0.1:8000",
      "/builder": "http://127.0.0.1:8000",
      "/director": "http://127.0.0.1:8000",
      "/shot-builder": "http://127.0.0.1:8000",
    },
  },
});
