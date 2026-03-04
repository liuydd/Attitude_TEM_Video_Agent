import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/recordings": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/training-videos": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
