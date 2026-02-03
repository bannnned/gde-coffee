import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // Открыть на всех интерфейсах
    port: 3001,
  },
  resolve: { dedupe: ['react', 'react-dom'] },
});
