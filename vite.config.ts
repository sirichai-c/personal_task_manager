import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const projectRoot = import.meta.dirname;
  const environment = loadEnv(mode, projectRoot, "");
  const apiPort = environment.PORT || process.env.PORT || "3000";

  return {
    root: resolve(projectRoot, "client"),
    envDir: projectRoot,
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
      },
    },
    build: {
      outDir: resolve(projectRoot, "dist/client"),
      emptyOutDir: true,
    },
  };
});

