import { defineConfig } from "vite";

export default defineConfig({
  root: "src/frontend",
  base: "./",
  build: {
    outDir: "../../dist/frontend",
    emptyOutDir: true,
    sourcemap: false,
  },
});
