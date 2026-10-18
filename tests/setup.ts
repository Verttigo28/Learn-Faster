import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { db } from "../src/db";

afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
