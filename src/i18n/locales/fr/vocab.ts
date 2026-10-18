import type en from "../en/vocab";

export default {
  titleRequired: "Titre requis.",
  notFound: "Deck introuvable",
  flashcards: "Flashcards",
  launchExam: "Se lancer dans un exam",
  manage: {
    heading: "Vocab — gérer les decks",
    intro: "Crée un deck, puis édite son contenu (termes, définitions, tags).",
    newDeck: "Nouveau deck",
    titlePlaceholder: "ex: Vacances",
    created: "Deck créé ✅",
    deleteConfirm: "Supprimer ce deck + tous ses items ?",
    deleted: "Deck supprimé ✅",
    listTitle: "Liste des decks",
    emptyTitle: "Aucun deck",
    emptyHint: "Crée ton premier deck à gauche, ou importe un JSON."
  },
  edit: {
    notFoundHint: "Retourne à la liste des decks.",
    heading: "Éditer deck",
    updated: "Deck mis à jour ✅",
    addItem: "Ajouter un item",
    term: "Terme",
    definition: "Définition",
    tags: "Tags (virgules)",
    termPlaceholder: "ex: makan",
    definitionPlaceholder: "ex: manger",
    tagsPlaceholder: "vacances, verbe",
    termDefinitionRequired: "Term et définition requis.",
    itemAdded: "Item ajouté ✅",
    itemUpdated: "Item mis à jour ✅",
    itemDeleteConfirm: "Supprimer cet item ?",
    itemDeleted: "Item supprimé ✅",
    itemsCount: "Items ({count})",
    emptyTitle: "Aucun item",
    emptyHint: "Ajoute ton premier item à gauche.",
    editModal: "Modifier un item"
  },
  deck: {
    review: "🧠 Réviser ({count})",
    reverse: "Sens inverse",
    examByTags: "Exam par tags",
    preview: "Contenu (aperçu)",
    emptyTitle: "Deck vide",
    emptyHint: "Importe des items depuis la page Import.",
    import: "Importer"
  }
} satisfies typeof en;
