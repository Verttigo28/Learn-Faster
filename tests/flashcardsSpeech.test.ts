// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import { h } from "vue";

// Each side of the card must speak the text it shows, in that text's language.
const { speak } = vi.hoisted(() => ({ speak: vi.fn(async () => true) }));
vi.mock("../src/services/speech", () => ({
  speak,
  speechSupported: () => true,
  languageName: (lang: string) => ({ id: "Indonesian", en: "English" })[lang] ?? lang
}));

import FlashcardsPage from "../src/pages/FlashcardsPage.vue";
import { importVocabDeck } from "../src/services/importer";

const Stub = { render: () => h("div") };

async function mountAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: Stub },
      { path: "/deck/:deckId", component: Stub },
      { path: "/deck/:deckId/flash", component: FlashcardsPage, props: true }
    ]
  });
  await router.push(path);
  await router.isReady();
  const w = mount({ render: () => h(RouterView) }, { global: { plugins: [router] }, attachTo: document.body });
  for (let i = 0; i < 100 && !w.text().includes("Listen"); i++) {
    await new Promise((r) => setTimeout(r, 5));
    await flushPromises();
  }
  return w;
}

const listen = (w: ReturnType<typeof mount>) => w.findAll("button.indexSpeak");

describe("flashcard audio language", () => {
  beforeEach(async () => {
    speak.mockClear();
    await importVocabDeck({
      type: "vocab_deck", id: "d", title: "Deck", from: "id", to: "en",
      items: [{ id: "1", term: "makan", definition: "to eat" }]
    });
  });

  it("speaks the word in the deck language and the answer in the translation language", async () => {
    const w = await mountAt("/deck/d/flash");
    expect(listen(w)[0].text()).toContain("Indonesian");
    await listen(w)[0].trigger("click");
    expect(speak).toHaveBeenLastCalledWith("makan", "id");

    await w.find(".indexCard").trigger("click"); // flip
    await flushPromises();
    expect(listen(w)[1].text()).toContain("English");
    await listen(w)[1].trigger("click");
    expect(speak).toHaveBeenLastCalledWith("to eat", "en");
    w.unmount();
  });

  it("swaps languages with the sides in reverse direction", async () => {
    const w = await mountAt("/deck/d/flash?dir=reverse");
    expect(listen(w)[0].text()).toContain("English");
    await listen(w)[0].trigger("click");
    expect(speak).toHaveBeenLastCalledWith("to eat", "en");

    await w.find(".indexCard").trigger("click");
    await flushPromises();
    expect(listen(w)[1].text()).toContain("Indonesian");
    await listen(w)[1].trigger("click");
    expect(speak).toHaveBeenLastCalledWith("makan", "id");
    w.unmount();
  });
});
