import { createApp } from "vue";
import { Capacitor } from "@capacitor/core";
import App from "./App.vue";
import { router } from "./router";
import { t } from "./i18n";
import "./style.css";

const app = createApp(App).use(router);
app.config.globalProperties.$t = t;
app.mount("#app");

// Offline support on the web (PWA). Not needed inside the native app.
if (import.meta.env.PROD && !Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
