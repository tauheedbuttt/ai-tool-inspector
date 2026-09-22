import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "./",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist/ui", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
  },
  server: {
    port: 4985,
    proxy: {
      "/api": "http://localhost:4984",
    },
  },
});
