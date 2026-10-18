import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // WebAssembly-only build that loads its .wasm from ort.env.wasm.wasmPaths (CDN) instead of
      // bundling ~12 MB of wasm into the app (see src/services/piper.ts).
      "onnxruntime-web/wasm": fileURLToPath(new URL("./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs", import.meta.url))
    }
  },
  plugins: [
    vue(),
    VitePWA({
      // Registered manually in main.ts (web only: the Android app already ships its files).
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: ["knowledge.ico", "icons/icon.svg"],
      manifest: {
        name: "Learn faster!",
        short_name: "Learn faster",
        description: "Offline language learning: flashcards, spaced repetition, quizzes and sentences.",
        lang: "en",
        theme_color: "#0b1020",
        background_color: "#0b1020",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,png,woff2}"],
        navigateFallback: "index.html",
        // Starter packs (~1.6 MB) are not precached: cached the first time they are downloaded.
        runtimeCaching: [
          {
            // Pre-recorded pronunciations: immutable, fetched on demand
            urlPattern: ({ url }) => url.pathname.includes("/audio/") && url.pathname.endsWith(".mp3"),
            handler: "CacheFirst",
            options: { cacheName: "audio", expiration: { maxEntries: 5000 } }
          },
          {
            // Neural voice runtime (ONNX runtime wasm, eSpeak phonemizer + data) from the CDN
            urlPattern: ({ url }) => url.hostname === "cdn.jsdelivr.net" && /onnxruntime-web|piper-wasm/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "voice-runtime", cacheableResponse: { statuses: [0, 200] } }
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("/packs/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "starter-packs" }
          }
        ]
      }
    })
  ]
});
