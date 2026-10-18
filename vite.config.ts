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
      includeAssets: ["knowledge.ico", "icon.svg"],
      manifest: {
        name: "Learn faster !",
        short_name: "Learn faster",
        description: "Révisions hors-ligne : vocabulaire, QCM, phrases, répétition espacée.",
        lang: "fr",
        theme_color: "#0b1020",
        background_color: "#0b1020",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,png,woff2}"],
        navigateFallback: "/index.html"
      }
    })
  ]
});
