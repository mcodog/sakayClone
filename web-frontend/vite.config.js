import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()], // ✅ Tailwind is configured via `tailwind.config.js`
  server: {
    watch: {
      ignored: ["**/src/assets/*.zip", "**/src/assets/loaders/*.gif"], // ✅ Ignore .zip files
    },
  },
  optimizeDeps: {
    include: ["@react-three/drei"],
  },
});
