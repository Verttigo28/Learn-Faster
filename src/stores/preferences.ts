import { defineStore } from "pinia";
import { ref, watch } from "vue";

const STORAGE_KEY = "learn-faster-prefs";

export interface Preferences {
  /** Seconds per question in practice mode (0 = no timer) */
  timerSeconds: number;
  /** Number of questions in practice mode */
  defaultQuestionCount: number;
  /** Auto-export reminder after N sessions (0 = disabled) */
  backupReminderInterval: number;
  /** Sessions completed since last export */
  sessionsSinceBackup: number;
}

const defaults: Preferences = {
  timerSeconds: 45,
  defaultQuestionCount: 20,
  backupReminderInterval: 10,
  sessionsSinceBackup: 0
};

function loadFromStorage(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaults };
}

export const usePreferencesStore = defineStore("preferences", () => {
  const prefs = ref<Preferences>(loadFromStorage());

  watch(prefs, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  }, { deep: true });

  function reset() {
    prefs.value = { ...defaults };
  }

  function incrementSessions() {
    prefs.value.sessionsSinceBackup++;
  }

  function resetBackupCounter() {
    prefs.value.sessionsSinceBackup = 0;
  }

  return { prefs, reset, incrementSessions, resetBackupCounter };
});
