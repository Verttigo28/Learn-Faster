import type { Settings } from "./settings";

export function applyTheme(theme: Settings["theme"]): void {
  document.documentElement.dataset.theme = theme;
}
