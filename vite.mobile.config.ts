import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(projectRoot, "mobile"),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": projectRoot },
  },
  build: {
    outDir: path.join(projectRoot, "dist-mobile"),
    emptyOutDir: true,
    target: "es2022",
  },
});
