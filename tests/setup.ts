import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { config } from "@vue/test-utils";
import { db } from "../src/db";
import { setLocale, t } from "../src/i18n";

// Assertions are written against the French UI.
setLocale("fr");
config.global.mocks = { $t: t };

afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
