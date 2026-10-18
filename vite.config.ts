import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,png,woff2}"],
        navigateFallback: "/index.html",
        // Starter packs (~1.6 MB) are not precached: cached the first time they are downloaded.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/packs/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "starter-packs" }
          }
        ]
      }
    })
  ]
});
