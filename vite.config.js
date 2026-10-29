import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://paullinde-oss.github.io/bmp-receipts/
export default defineConfig({
  base: "/bmp-receipts/",
  plugins: [react()],
});
