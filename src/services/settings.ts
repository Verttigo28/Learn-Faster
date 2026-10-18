import { db } from "../db";

export const DEFAULT_SETTINGS = {
  /** Nouvelles cartes SRS introduites par jour */
  newPerDay: 20,
  /** Objectif quotidien (nombre de réponses) */
  dailyGoal: 30,
  /** Date (ms) du dernier export JSON */
  lastExportAt: 0,
  /** Thème: "dark" | "light" | "system" */
  theme: "dark" as "dark" | "light" | "system",
  /** Synthèse vocale automatique en flashcards */
  autoSpeak: false
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key);
  return (row?.value as Settings[K] | undefined) ?? DEFAULT_SETTINGS[key];
}

export async function setSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getAllSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out as Settings;
}
