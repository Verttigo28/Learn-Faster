<script setup lang="ts">
import { ref } from "vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import { isQcmExamJson, isVocabDeckJson, isSentenceDeckJson, isRevisionsBundleJson } from "../types/json";
import { importQcmExam, importVocabDeck, importSentenceDeck, importBundle } from "../services/importer";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const message = ref<{ text: string; kind: "info" | "ok" | "danger" } | null>(null);
const raw = ref<string>("");
const url = ref<string>("");
const loading = ref(false);

/** ✅ File input custom */
const fileInput = ref<HTMLInputElement | null>(null);
const fileName = ref<string>("");

function set(kind: "info" | "ok" | "danger", text: string) {
  message.value = { kind, text };
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  fileName.value = file?.name ?? "";
  if (!file) return;

  set("info", "Lecture du fichier…");
  const text = await file.text();
  raw.value = text;

  await importFromText(text);
}

async function importFromText(text: string) {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    set("danger", "JSON invalide (erreur de parsing).");
    return;
  }

  try {
    // ✅ bundle global
    if (isRevisionsBundleJson(data)) {
      const r = await importBundle(data);
      set(
          "ok",
          `Bundle importé ✅ Decks:${r.decks} (items:${r.vocabItems}) • Exams:${r.exams} (questions:${r.qcmQuestions}) • Phrases:${r.sentences}`
      );
      return;
    }

    if (isVocabDeckJson(data)) {
      const res = await importVocabDeck(data);
      set("ok", `Deck vocab importé: ${res.title} (${res.count} items)`);
      return;
    }

    if (isQcmExamJson(data)) {
      const res = await importQcmExam(data);
      set("ok", `Exam QCM importé: ${res.title} (${res.count} questions)`);
      return;
    }

    if (isSentenceDeckJson(data)) {
      const res = await importSentenceDeck(data);
      set("ok", `Phrases importées: ${res.title} (${res.count} phrases)`);
      return;
    }

    set("danger", "JSON non reconnu. Types: vocab_deck / qcm_exam / sentence_deck / revisions_bundle.");
  } catch (e: any) {
    set("danger", `Erreur import: ${e?.message ?? "inconnue"}`);
  }
}

async function onImportClick() {
  await importFromText(raw.value);
}

async function onImportUrl() {
  const u = url.value.trim();
  if (!u) return set("danger", "Ajoute une URL.");
  try {
    new URL(u);
  } catch {
    return set("danger", "URL invalide.");
  }

  set("info", "Téléchargement du JSON…");
  loading.value = true;

  try {
    let text = "";

    if (Capacitor.isNativePlatform()) {
      // ✅ Android/iOS: requête native => pas de CORS WebView
      const r = await CapacitorHttp.get({
        url: u,
        responseType: "text",       // important: on veut du texte JSON
        disableRedirects: true      // optionnel: détecte les redirects (www -> apex)
      });
      if (r.status < 200 || r.status >= 300) {
        return set("danger", `Erreur HTTP ${r.status}`);
      }
      text = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
    } else {
      // 🌐 Web: fetch normal (CORS navigateur)
      const res = await fetch(u, { method: "GET" });
      if (!res.ok) return set("danger", `Erreur HTTP ${res.status} (${res.statusText})`);
      text = await res.text();
    }

    raw.value = text;
    await importFromText(text);
  } catch (e: any) {
    set("danger", `Impossible de récupérer l'URL. ${e?.message ?? ""}`.trim());
  } finally {
    loading.value = false;
  }
}


const exampleBundle = `{
  "type": "revisions_bundle",
  "schema": 1,
  "exportedAt": 1700000000000,
  "vocabDecks": [],
  "qcmExams": [],
  "sentenceDecks": []
}`;
</script>

<template>
  <div class="importPage">
    <div class="card cardFill">
      <h2>Importer un JSON</h2>
      <p class="small">
        Types : <b>vocab_deck</b>, <b>qcm_exam</b>, <b>sentence_deck</b>, <b>revisions_bundle</b>.
      </p>

      <!-- ✅ Upload JSON (bouton stylé) -->
      <div class="fileRow">
        <input
          ref="fileInput"
          class="fileInput"
          type="file"
          accept="application/json,.json"
          @change="onFile"
        />

        <button class="btn" type="button" @click="fileInput?.click()">
          📄 Choisir un fichier
        </button>

        <div class="fileName small">
          {{ fileName || "Aucun fichier sélectionné" }}
        </div>
      </div>

      <label class="small mt-2.5 block">Importer depuis une URL (JSON)</label>
      <div class="row gap-2.5 flex-nowrap">
        <input class="input" v-model="url" placeholder="https://.../file.json" />
        <button class="btn whitespace-nowrap" @click="onImportUrl" :disabled="loading">
          {{ loading ? "Chargement…" : "Importer URL" }}
        </button>
      </div>

      <div class="hr"></div>

      <label class="small">Coller du JSON (optionnel)</label>

      <!-- ✅ Scroll interne (pas de resize qui casse le no-scroll) -->
      <textarea
        class="input flex-1 min-h-0 resize-none"
        v-model="raw"
        placeholder="Colle ici ton JSON..."
      ></textarea>

      <div class="row mt-3">
        <button class="btn primary" @click="onImportClick">Importer le texte</button>
      </div>

      <div class="mt-3" v-if="message">
        <ConfirmBar :message="message.text" :kind="message.kind" />
      </div>
    </div>

    <div class="card cardFill">
      <h2>Exemple export global (bundle)</h2>
      <p class="small">C’est exactement ce que produit le bouton "Exporter mes données (JSON)" sur la Home.</p>
      <pre class="code">{{ exampleBundle }}</pre>
    </div>
  </div>
</template>

