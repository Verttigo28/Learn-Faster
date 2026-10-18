import { expect, test, type Page } from "@playwright/test";

// Pronunciation without any device voice (headless Chromium has none).
test.use({ locale: "en-US" });

const deck = {
  type: "vocab_deck",
  id: "audio-test",
  title: "Audio test",
  from: "id",
  to: "en",
  items: [
    { id: "1", term: "makan", definition: "to eat" }, // in the starter packs -> recorded
    { id: "2", term: "kucing oranye tidur siang", definition: "orange cat napping" } // custom -> neural
  ]
};

async function setup(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __speak: { kind: string; text: string }[] }).__speak = [];
    window.addEventListener("lf-speak", (e) =>
      (window as unknown as { __speak: unknown[] }).__speak.push((e as CustomEvent).detail)
    );
  });
  await page.goto("/import");
  await page.getByPlaceholder(/Paste your JSON/i).fill(JSON.stringify(deck));
  await page.getByRole("button", { name: "Import text", exact: true }).click();
  await expect(page.getByText(/Vocab deck imported/i)).toBeVisible();
  await page.goto(`/deck/${deck.id}`);
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __speak: { kind: string; text: string }[] }).__speak);

test("pack words play their pre-recorded audio", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Listen to makan" }).click();
  await expect.poll(() => spoken(page)).toContainEqual({ kind: "recorded", text: "makan" });
});

test("custom words use the in-browser neural voice", async ({ page }) => {
  test.skip(!process.env.RUN_NEURAL, "downloads ~80 MB; run with RUN_NEURAL=1");
  test.setTimeout(240_000);
  await setup(page);
  await page.getByRole("button", { name: "Listen to kucing oranye tidur siang" }).click();
  await expect(page.getByText(/Downloading the Indonesian voice/)).toBeVisible();
  await expect
    .poll(() => spoken(page), { timeout: 220_000 })
    .toContainEqual({ kind: "neural", text: "kucing oranye tidur siang" });
});
