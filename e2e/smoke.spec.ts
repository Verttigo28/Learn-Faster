import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });
}

const bundle = {
  type: "revisions_bundle",
  schema: 1,
  exportedAt: 0,
  vocabDecks: [
    {
      type: "vocab_deck", id: "id-basics", title: "Indonésien — bases", from: "id", to: "fr",
      items: [
        { id: "1", term: "makan", definition: "manger", tags: ["verbe"] },
        { id: "2", term: "minum", definition: "boire", tags: ["verbe"] },
        { id: "3", term: "rumah", definition: "maison" },
        { id: "4", term: "besar", definition: "grand" },
        { id: "5", term: "kecil", definition: "petit" }
      ]
    }
  ],
  qcmExams: [
    {
      type: "qcm_exam", id: "neg", title: "Négation", durationSeconds: 300,
      questions: [
        {
          id: "1", prompt: "Négation d'un verbe ?", explanation: "tidak + verbe",
          choices: [{ id: "a", text: "tidak", correct: true }, { id: "b", text: "bukan", correct: false }]
        }
      ]
    }
  ],
  sentenceDecks: [
    {
      type: "sentence_deck", id: "s1", title: "Au restaurant",
      items: [{ id: "1", text: "Saya mau makan nasi goreng", translation: "Je veux manger du riz frit" }]
    }
  ]
};

async function importBundle(page: Page) {
  await page.goto("/import");
  await page.getByPlaceholder("Colle ici ton JSON...").fill(JSON.stringify(bundle));
  await page.getByRole("button", { name: "Importer le texte" }).click();
  await expect(page.getByText("Bundle importé")).toBeVisible();
}

const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") list.push(m.text()); });
});

test.afterEach(async ({ page }) => {
  const list = errors.get(page) ?? [];
  expect(list, `console errors: ${list.join(" | ")}`).toEqual([]);
});

test("home, import and daily review", async ({ page }) => {
  await page.goto("/");
  await shot(page, "01-home-empty");
  await importBundle(page);
  await shot(page, "02-import");

  await page.goto("/");
  await expect(page.getByText("0 à revoir • 5 nouvelles")).toBeVisible();
  await shot(page, "03-home");

  await page.getByRole("link", { name: /Révision du jour/ }).click();
  await expect(page.getByText("5 restante(s)")).toBeVisible();
  await shot(page, "04-review-front");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Afficher la réponse" }).click();
    if (i === 0) await shot(page, "05-review-back");
    await page.getByRole("button", { name: /^Bien/ }).click();
  }
  await expect(page.getByRole("dialog")).toContainText("Résultat flashcards");
  await shot(page, "06-review-done");
  await page.getByRole("dialog").getByRole("link", { name: "Voir les stats" }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByText("🔥 1 j")).toBeVisible();
  await shot(page, "07-stats");
  await page.getByRole("button", { name: "Progression decks" }).click();
  await expect(page.getByText(/5 en cours/)).toBeVisible();
  await shot(page, "08-stats-decks");
});

test("practice with typed answers, cloze, order and QCM", async ({ page }) => {
  await importBundle(page);
  await page.goto("/practice?count=20&sources=typed,cloze,order,exam");
  await expect(page.getByText(/Question 1 \/ 8/)).toBeVisible();
  await shot(page, "09-practice");

  const typed = page.getByPlaceholder("Ta réponse… (Entrée pour valider)");
  for (let i = 0; i < 8; i++) {
    await expect(page.getByText(new RegExp(`Question ${i + 1} / 8`))).toBeVisible();
    if (await typed.isVisible()) {
      await typed.fill("xyz");
      await typed.press("Enter");
      await expect(page.getByText("Réponse attendue")).toBeVisible();
      if (i === 0) await shot(page, "09b-typed-correction");
      await page.keyboard.press("Enter");
    } else if (await page.getByText("Remets la phrase dans le bon ordre").isVisible()) {
      const pool = page.locator(".sessionBody .flex.flex-wrap").nth(1).locator("button");
      while ((await pool.count()) > 0) await pool.first().click();
      // "Suivant" validates and advances in one click
      await page.getByRole("button", { name: "Suivant" }).click();
    } else {
      await page.keyboard.press("1");
      await page.getByRole("button", { name: "Suivant" }).click();
    }
  }
  await expect(page.getByRole("dialog")).toContainText("Résultat (exam tags)");
  await shot(page, "10-practice-done");
});

test("csv import, search, settings and light theme", async ({ page }) => {
  await page.goto("/import");
  await page.getByPlaceholder("Titre du nouveau deck").fill("CSV deck");
  await page.locator("textarea").nth(1).fill("terme;définition\nair;eau\napi;feu;nature\n");
  await expect(page.getByText("2 ligne(s) valides")).toBeVisible();
  await page.getByRole("button", { name: "Importer dans le deck" }).click();
  await expect(page.getByText("2 item(s) ajouté(s)")).toBeVisible();

  await page.goto("/search");
  await page.getByPlaceholder(/Mot, traduction/).fill("FEU");
  await expect(page.getByText("api → feu")).toBeVisible();
  await shot(page, "11-search");

  await page.goto("/settings");
  await page.getByRole("button", { name: "☀️ Clair" }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Réglages enregistrés")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await shot(page, "12-home-light");
  await page.goto("/stats");
  await shot(page, "13-stats-light");
});

test("leaving a practice session asks for confirmation", async ({ page }) => {
  await importBundle(page);
  await page.goto("/practice?count=5&sources=exam,vocab");
  await expect(page.getByText("Question 1 / 5")).toBeVisible();
  await page.keyboard.press("1");
  await page.getByRole("button", { name: "Suivant" }).click();
  await page.getByRole("button", { name: "Quitter" }).click();
  await expect(page.getByRole("dialog")).toContainText("Quitter la session");
  await shot(page, "14-leave-guard");
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  await expect(page).toHaveURL(/\/practice/);
});

test("leaving flashcards mid-session keeps the cards studied", async ({ page }) => {
  await importBundle(page);
  await page.goto("/deck/id-basics/flash");
  await page.getByRole("button", { name: /^Afficher la réponse/ }).click();
  await page.getByRole("button", { name: /^Bien/ }).click();
  // no confirmation: the graded card is already saved
  await page.locator(".sessionCard").getByRole("link", { name: "Retour" }).click();
  await expect(page).toHaveURL(/\/deck\/id-basics$/);
  await page.goto("/stats");
  await expect(page.getByText("1 entrées")).toBeVisible();
});

test("switching from due-only to the full deck reloads the cards", async ({ page }) => {
  await importBundle(page);
  await page.goto("/settings");
  await page.locator("input[type=number]").first().fill("0");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Réglages enregistrés")).toBeVisible();

  await page.goto("/deck/id-basics/flash?mode=due");
  await expect(page.getByText("Rien à réviser")).toBeVisible();
  await page.getByRole("link", { name: "Réviser tout le deck" }).click();
  await expect(page.getByText("5 restante(s)")).toBeVisible();
});
