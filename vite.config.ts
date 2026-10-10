import { resolve } from "node:path";
import { defineConfig } from "vite";

// Custom domain on GitHub Pages → root base.
export default defineConfig({
  base: "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        offerSalon: resolve(import.meta.dirname, "offer/salon.html"),
      },
    },
  },
});
