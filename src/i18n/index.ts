import { ref } from "vue";
import { LOCALES, type LocaleCode } from "./locales";

/**
 * Tiny i18n layer (no dependency).
 *
 * - Messages live in `src/i18n/locales/<code>/<namespace>.ts`; English is the source of truth and every
 *   other locale is type-checked against it (a missing key is a build error).
 * - Keys are dotted paths: t("home.title"), t("stats.entries", { count: 3 }).
 * - "{name}" placeholders are replaced by params; "one | other" picks a form from params.count
 *   using Intl.PluralRules of the current locale.
 *
 * To add a language: see src/i18n/locales/index.ts.
 */

export const DEFAULT_LOCALE: LocaleCode = "en";

export const locale = ref<LocaleCode>(detectLocale());

export function detectLocale(): LocaleCode {
  const langs = typeof navigator !== "undefined" ? (navigator.languages ?? [navigator.language]) : [];
  for (const l of langs) {
    const code = l?.slice(0, 2).toLowerCase();
    if (code && code in LOCALES) return code as LocaleCode;
  }
  return DEFAULT_LOCALE;
}

export function isLocale(x: unknown): x is LocaleCode {
  return typeof x === "string" && x in LOCALES;
}

export function setLocale(code: LocaleCode): void {
  locale.value = code;
  if (typeof document !== "undefined") document.documentElement.lang = code;
}

type Params = Record<string, string | number | undefined>;

function lookup(messages: unknown, key: string): string | undefined {
  let cur: unknown = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

const pluralRules = new Map<string, Intl.PluralRules>();
function pluralIndex(code: string, count: number): number {
  let rules = pluralRules.get(code);
  if (!rules) {
    rules = new Intl.PluralRules(code);
    pluralRules.set(code, rules);
  }
  return rules.select(count) === "one" ? 0 : 1;
}

/** Translate a key in the current locale (falls back to English, then to the key itself). */
export function t(key: string, params: Params = {}): string {
  const code = locale.value;
  let msg = lookup(LOCALES[code].messages, key) ?? lookup(LOCALES[DEFAULT_LOCALE].messages, key);
  if (msg === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  if (msg.includes("|") && typeof params.count === "number") {
    const forms = msg.split("|").map((s) => s.trim());
    msg = forms[Math.min(pluralIndex(code, params.count), forms.length - 1)];
  }
  return msg.replace(/\{(\w+)\}/g, (m, name: string) => (params[name] !== undefined ? String(params[name]) : m));
}

/** BCP 47 tag for Intl / toLocaleString. */
export function intlLocale(): string {
  return LOCALES[locale.value].intl;
}
