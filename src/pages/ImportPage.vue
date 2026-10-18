<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ConfirmBar from "../components/ConfirmBar.vue";
import StarterPacks from "../components/StarterPacks.vue";
import { validateImport } from "../services/validate";
import { importQcmExam, importVocabDeck, importSentenceDeck, importBundle, importVocabRows } from "../services/importer";
import { rowsToVocab } from "../utils/csv";
import { toast } from "../services/dialog";
import { db, type VocabDeck } from "../db";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { t } from "../i18n";

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

  set("info", t("importPage.readingFile"));
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
    set("danger", t("importPage.invalidJson", { error: e instanceof Error ? e.message : t("importPage.parseError") }));
    return;
  }

  const v = validateImport(data);
  if (!v.ok) {
    errors.value = v.errors;
    set("danger", t("importPage.rejected", { n: `${v.errors.length}${v.errors.length >= 20 ? "+" : ""}` }));
    return;
  }

  try {
    const p = v.payload;
    if (p.type === "revisions_bundle") {
      const r = await importBundle(p.data);
      set(
          "ok",
          t("importPage.bundleImported", { decks: r.decks, items: r.vocabItems, exams: r.exams, questions: r.qcmQuestions, sentences: r.sentences })
      );
    } else if (p.type === "vocab_deck") {
      const res = await importVocabDeck(p.data);
      set("ok", t("importPage.deckImported", { title: res.title, count: res.count }));
    } else if (p.type === "qcm_exam") {
      const res = await importQcmExam(p.data);
      set("ok", t("importPage.examImported", { title: res.title, count: res.count }));
    } else {
      const res = await importSentenceDeck(p.data);
      set("ok", t("importPage.sentencesImported", { title: res.title, count: res.count }));
    }
  } catch (e) {
    set("danger", t("importPage.importError", { error: e instanceof Error ? e.message : t("common.unknown") }));
  }
}

async function onImportClick() {
  await importFromText(raw.value);
}

async function onImportUrl() {
  const u = url.value.trim();
  if (!u) return set("danger", t("importPage.urlRequired"));
  try {
    new URL(u);
  } catch {
    return set("danger", t("importPage.urlInvalid"));
  }

  set("info", t("importPage.downloading"));

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
        return set("danger", t("importPage.httpError", { status: r.status }));
      }
      text = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
    } else {
      // 🌐 Web: fetch normal (CORS navigateur)
      const res = await fetch(u, { method: "GET" });
      if (!res.ok) return set("danger", t("importPage.httpErrorText", { status: res.status, text: res.statusText }));
      text = await res.text();
    }

    raw.value = text;
    await importFromText(text);
  } catch (e) {
    set("danger", t("importPage.fetchError", { error: e instanceof Error ? e.message : "" }).trim());
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
  if (!title) return toast(t("importPage.csvTitleRequired"), "danger");
  try {
    const r = await importVocabRows({
      deckId: existing?.id,
      title,
      from: existing?.from ?? (csvFrom.value.trim() || "id"),
      to: existing?.to ?? (csvTo.value.trim() || "fr"),
      rows
    });
    toast(`${t("importPage.csvAdded", { added: r.added, title })}${r.duplicates ? t("importPage.csvDuplicates", { n: r.duplicates }) : ""}`, "ok", 5000);
    csvText.value = "";
    csvFileName.value = "";
    await loadDecks();
    csvDeckId.value = r.deckId;
  } catch (e) {
    toast(t("importPage.csvError", { error: e instanceof Error ? e.message : t("common.unknown") }), "danger");
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
      <h2>{{ $t("importPage.jsonTitle") }}</h2>
      <p class="small">
        {{ $t("importPage.types") }} <b>vocab_deck</b>, <b>qcm_exam</b>, <b>sentence_deck</b>, <b>revisions_bundle</b>.
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
          {{ $t("importPage.chooseFile") }}
        </button>

        <div class="fileName small">
          {{ fileName || $t("importPage.noFile") }}
        </div>
      </div>

      <label class="small mt-2.5 block">{{ $t("importPage.fromUrl") }}</label>
      <div class="row gap-2.5 flex-nowrap">
        <input class="input" v-model="url" placeholder="https://.../file.json" />
        <button class="btn whitespace-nowrap" @click="onImportUrl">{{ $t("importPage.importUrl") }}</button>
      </div>

      <div class="hr"></div>

      <label class="small">{{ $t("importPage.pasteLabel") }}</label>

      <!-- ✅ Scroll interne (pas de resize qui casse le no-scroll) -->
      <textarea
        class="input flex-1 min-h-0 resize-none"
        v-model="raw"
        :placeholder="$t('importPage.pastePlaceholder')"
      ></textarea>

      <div class="row mt-3">
        <button class="btn primary" @click="onImportClick">{{ $t("importPage.importText") }}</button>
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
        <StarterPacks @installed="loadDecks" />
        <div class="hr"></div>

        <h2>{{ $t("importPage.csvHeading") }}</h2>
        <p class="small">
          {{ $t("importPage.csvHint") }}
          {{ $t("importPage.csvColumns") }} <b>{{ $t("importPage.csvTerm") }}</b>, <b>{{ $t("importPage.csvDefinition") }}</b>, {{ $t("importPage.csvTagsOptional") }} {{ $t("importPage.csvSeparator") }}
        </p>

        <label class="small">{{ $t("importPage.deck") }}</label>
        <select class="input" v-model="csvDeckId">
          <option value="">{{ $t("importPage.newDeck") }}</option>
          <option v-for="d in vocabDecks" :key="d.id" :value="d.id">{{ d.title }} ({{ d.from }} → {{ d.to }})</option>
        </select>

        <template v-if="!csvDeckId">
          <input class="input mt-2" v-model="csvTitle" :placeholder="$t('importPage.newDeckTitle')" />
          <div class="row mt-2 gap-2.5 flex-nowrap">
            <input class="input" v-model="csvFrom" :placeholder="$t('importPage.fromPlaceholder')" />
            <input class="input" v-model="csvTo" :placeholder="$t('importPage.toPlaceholder')" />
          </div>
        </template>

        <div class="fileRow">
          <input ref="csvFileInput" class="fileInput" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" @change="onCsvFile" />
          <button class="btn" type="button" @click="csvFileInput?.click()">{{ $t("importPage.csvFile") }}</button>
          <span class="small">{{ csvFileName || $t("importPage.csvPasteHint") }}</span>
        </div>

        <textarea class="input mt-2 min-h-[120px] resize-y" v-model="csvText" :placeholder="$t('importPage.csvPlaceholder')"></textarea>
        <p class="small">{{ $t("importPage.csvValidRows", { n: csvPreview.rows.length }) }}<span v-if="csvPreview.skipped"> • {{ $t("importPage.csvSkipped", { n: csvPreview.skipped }) }}</span></p>
        <ul v-if="csvPreview.rows.length" class="small pl-5 list-disc">
          <li v-for="(r, i) in csvPreview.rows.slice(0, 3)" :key="i">{{ r.term }} → {{ r.definition }}<span v-if="r.tags.length"> ({{ r.tags.join(", ") }})</span></li>
        </ul>

        <button class="btn primary mt-2" :disabled="!csvPreview.rows.length" @click="onImportCsv">{{ $t("importPage.csvImport") }}</button>

        <div class="hr"></div>
        <details>
          <summary class="small cursor-pointer">{{ $t("importPage.exampleSummary") }}</summary>
          <p class="small">{{ $t("importPage.exampleHint") }}</p>
          <pre class="code">{{ exampleBundle }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

