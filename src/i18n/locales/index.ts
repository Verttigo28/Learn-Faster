import en from "./en";
import fr from "./fr";

/**
 * Registered UI languages.
 *
 * Add a language in 3 steps:
 *   1. Copy the folder `src/i18n/locales/en` to `src/i18n/locales/<code>` (e.g. `id`, `es`).
 *   2. Translate the strings (keep the keys and the {placeholders}; "one | other" = plural forms).
 *      Each file is typed against English, so `npm run build` lists any missing key.
 *   3. Import it below and add an entry to LOCALES (name = how the language calls itself).
 */
export const LOCALES = {
  en: { name: "English", intl: "en-US", messages: en },
  fr: { name: "Français", intl: "fr-FR", messages: fr }
} as const;

export type LocaleCode = keyof typeof LOCALES;
