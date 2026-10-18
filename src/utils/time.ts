import { intlLocale } from "../i18n";
export function formatDate(ts: number): string {
  const d = new Date(ts);
  // month option was invalid before; must be "2-digit"
  return d.toLocaleString(intlLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
