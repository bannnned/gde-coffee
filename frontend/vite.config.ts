import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("maplibre-gl")) return "vendor-map";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (
            id.includes("@mantine/") ||
            id.includes("@tabler/icons-react") ||
            id.includes("@floating-ui")
          ) {
            return "vendor-ui";
          }
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("zod")
          ) {
            return "vendor-forms";
          }
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          return;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
    host: "0.0.0.0", // Открыть на всех интерфейсах
    port: 3001,
  },
  resolve: { dedupe: ['react', 'react-dom'] },
});
