<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import { validateImport } from "../services/validate";
import { importQcmExam, importVocabDeck, importSentenceDeck, importBundle, importVocabRows } from "../services/importer";
import { rowsToVocab } from "../utils/csv";
import { toast } from "../services/dialog";
import { db, type VocabDeck } from "../db";
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const message = ref<{ text: string; kind: "info" | "ok" | "danger" } | null>(null);
const raw = ref<string>("");
const url = ref<string>("");
const errors = ref<string[]>([]);

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
  errors.value = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    set("danger", `JSON invalide : ${e instanceof Error ? e.message : "erreur de parsing"}`);
    return;
  }

  const v = validateImport(data);
  if (!v.ok) {
    errors.value = v.errors;
    set("danger", `JSON refusé (${v.errors.length}${v.errors.length >= 20 ? "+" : ""} erreur(s)). Rien n'a été importé.`);
    return;
  }

  try {
    const p = v.payload;
    if (p.type === "revisions_bundle") {
      const r = await importBundle(p.data);
      set(
          "ok",
          `Bundle importé ✅ Decks:${r.decks} (items:${r.vocabItems}) • Exams:${r.exams} (questions:${r.qcmQuestions}) • Phrases:${r.sentences}`
      );
    } else if (p.type === "vocab_deck") {
      const res = await importVocabDeck(p.data);
      set("ok", `Deck vocab importé: ${res.title} (${res.count} items)`);
    } else if (p.type === "qcm_exam") {
      const res = await importQcmExam(p.data);
      set("ok", `Exam QCM importé: ${res.title} (${res.count} questions)`);
    } else {
      const res = await importSentenceDeck(p.data);
      set("ok", `Phrases importées: ${res.title} (${res.count} phrases)`);
    }
  } catch (e) {
    set("danger", `Erreur import: ${e instanceof Error ? e.message : "inconnue"}`);
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
  } catch (e) {
    set("danger", `Impossible de récupérer l'URL. ${e instanceof Error ? e.message : ""}`.trim());
  }
}


// --- CSV / TSV vocab import ---
const vocabDecks = ref<VocabDeck[]>([]);
const csvDeckId = ref("");
const csvTitle = ref("");
const csvFrom = ref("id");
const csvTo = ref("fr");
const csvText = ref("");
const csvFileName = ref("");
const csvFileInput = ref<HTMLInputElement | null>(null);
const csvPreview = computed(() => rowsToVocab(csvText.value));

async function loadDecks() {
  vocabDecks.value = await db.vocabDecks.orderBy("title").toArray();
}

async function onCsvFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  csvFileName.value = file?.name ?? "";
  if (!file) return;
  csvText.value = await file.text();
  if (!csvDeckId.value && !csvTitle.value) csvTitle.value = file.name.replace(/\.[^.]+$/, "");
}

async function onImportCsv() {
  const rows = csvPreview.value.rows;
  if (!rows.length) return;
  const existing = vocabDecks.value.find((d) => d.id === csvDeckId.value);
  const title = existing?.title ?? csvTitle.value.trim();
  if (!title) return toast("Donne un titre au nouveau deck.", "danger");
  try {
    const r = await importVocabRows({
      deckId: existing?.id,
      title,
      from: existing?.from ?? (csvFrom.value.trim() || "id"),
      to: existing?.to ?? (csvTo.value.trim() || "fr"),
      rows
    });
    toast(`${r.added} item(s) ajouté(s) à « ${title} »${r.duplicates ? ` • ${r.duplicates} doublon(s) ignoré(s)` : ""}`, "ok", 5000);
    csvText.value = "";
    csvFileName.value = "";
    await loadDecks();
    csvDeckId.value = r.deckId;
  } catch (e) {
    toast(`Erreur import CSV: ${e instanceof Error ? e.message : "inconnue"}`, "danger");
  }
}

onMounted(loadDecks);

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
        <button class="btn whitespace-nowrap" @click="onImportUrl">Importer URL</button>
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
        <ul v-if="errors.length" class="small mt-2 max-h-40 overflow-auto pl-5 list-disc">
          <li v-for="(e, i) in errors" :key="i"><code>{{ e }}</code></li>
        </ul>
      </div>
    </div>

    <div class="card cardFill">
      <div class="scrollY">
        <h2>Importer du vocab en CSV / TSV</h2>
        <p class="small">
          Export Anki (« Notes en texte brut »), Quizlet, ou copier-coller depuis un tableur.
          Colonnes : <b>terme</b>, <b>définition</b>, tags (optionnel). Séparateur détecté automatiquement.
        </p>

        <label class="small">Deck</label>
        <select class="input" v-model="csvDeckId">
          <option value="">➕ Nouveau deck</option>
          <option v-for="d in vocabDecks" :key="d.id" :value="d.id">{{ d.title }} ({{ d.from }} → {{ d.to }})</option>
        </select>

        <template v-if="!csvDeckId">
          <input class="input mt-2" v-model="csvTitle" placeholder="Titre du nouveau deck" />
          <div class="row mt-2 gap-2.5 flex-nowrap">
            <input class="input" v-model="csvFrom" placeholder="De (ex: id)" />
            <input class="input" v-model="csvTo" placeholder="Vers (ex: fr)" />
          </div>
        </template>

        <div class="fileRow">
          <input ref="csvFileInput" class="fileInput" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" @change="onCsvFile" />
          <button class="btn" type="button" @click="csvFileInput?.click()">📄 Fichier CSV / TSV</button>
          <span class="small">{{ csvFileName || "ou colle le contenu ci-dessous" }}</span>
        </div>

        <textarea class="input mt-2 min-h-[120px] resize-y" v-model="csvText" placeholder="makan	manger	verbe&#10;minum	boire"></textarea>
        <p class="small">{{ csvPreview.rows.length }} ligne(s) valides<span v-if="csvPreview.skipped"> • {{ csvPreview.skipped }} ignorée(s)</span></p>
        <ul v-if="csvPreview.rows.length" class="small pl-5 list-disc">
          <li v-for="(r, i) in csvPreview.rows.slice(0, 3)" :key="i">{{ r.term }} → {{ r.definition }}<span v-if="r.tags.length"> ({{ r.tags.join(", ") }})</span></li>
        </ul>

        <button class="btn primary mt-2" :disabled="!csvPreview.rows.length" @click="onImportCsv">Importer dans le deck</button>

        <div class="hr"></div>
        <details>
          <summary class="small cursor-pointer">Exemple export global (bundle JSON)</summary>
          <p class="small">C’est exactement ce que produit le bouton “Exporter” sur l’accueil.</p>
          <pre class="code">{{ exampleBundle }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

