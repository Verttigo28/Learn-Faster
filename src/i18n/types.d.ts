import type { t } from "./index";

declare module "vue" {
  interface ComponentCustomProperties {
    /** Translate a key (see src/i18n). */
    $t: typeof t;
  }
}

export {};
