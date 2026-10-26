import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // during `npm run dev`, the content-save API is proxied to the Node server (npm start)
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
