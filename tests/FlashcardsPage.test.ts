// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { h } from "vue";
import FlashcardsPage from "../src/pages/FlashcardsPage.vue";
import { db } from "../src/db";
import { importVocabDeck } from "../src/services/importer";

const Stub = { render: () => h("div") };

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Stub },
      { path: "/review", component: FlashcardsPage },
      { path: "/deck/:deckId", component: Stub },
      { path: "/deck/:deckId/flash", component: FlashcardsPage, props: true }
    ]
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

async function settle(w: ReturnType<typeof mount>, text: string) {
  for (let i = 0; i < 100 && !w.text().includes(text); i++) {
    await new Promise((r) => setTimeout(r, 5));
    await flushPromises();
  }
}

const button = (w: ReturnType<typeof mount>, text: string) => w.findAll("button").find((b) => b.text().startsWith(text))!;

describe("FlashcardsPage", () => {
  it("grades cards, saves SRS state and records the attempt", async () => {
    await importVocabDeck({
      type: "vocab_deck", id: "d", title: "Deck", from: "id", to: "fr",
      items: [{ id: "1", term: "makan", definition: "manger" }, { id: "2", term: "minum", definition: "boire" }]
    });

    const w = await mountAt("/review");
    await settle(w, "restante");
    expect(w.text()).toContain("2 restante(s)");

    // card 1: Again -> comes back at the end of the queue
    await button(w, "Afficher la réponse").trigger("click");
    await button(w, "À revoir").trigger("click");
    await flushPromises();
    await new Promise((r) => setTimeout(r, 20));
    await settle(w, "restante");
    expect(w.text()).toContain("2 restante(s)");

    // remaining cards: Good
    for (let i = 0; i < 2; i++) {
      await button(w, "Afficher la réponse").trigger("click");
      await button(w, "Bien").trigger("click");
      await flushPromises();
      await new Promise((r) => setTimeout(r, 20));
    }

    await settle(w, "Résultat flashcards");
    const reviews = await db.reviews.toArray();
    expect(reviews).toHaveLength(2);
    expect(reviews.every((r) => r.interval === 1)).toBe(true);

    const [attempt] = await db.attempts.toArray();
    expect(attempt).toMatchObject({ type: "flashcards", refId: "review", meta: { total: 2, correct: 1 } });
    w.unmount();
  });

  it("shows the reverse side first with ?dir=reverse", async () => {
    await importVocabDeck({
      type: "vocab_deck", id: "d", title: "Deck", from: "id", to: "fr",
      items: [{ id: "1", term: "makan", definition: "manger" }]
    });
    const w = await mountAt("/deck/d/flash?dir=reverse");
    await settle(w, "manger");
    expect(w.text()).toContain("manger");
    expect(w.text()).not.toContain("makan");
    w.unmount();
  });
});
