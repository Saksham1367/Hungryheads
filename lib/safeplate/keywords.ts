/**
 * SafePlate deterministic keyword layer.
 *
 * The structured `allergen_tags` on a menu item are the primary signal, but
 * tags can be missing or incomplete — a restaurant mislabels a dish, or the
 * agent reads a freeform ingredient string and overlooks one word. This module
 * is the second, dumb-but-reliable layer: it scans the raw item text
 * (name + description + any ingredient list) for allergen keywords and their
 * common synonyms, so a missing tag can't let an allergen reach checkout.
 *
 * No LLM, no fuzzy matching — pure word-boundary string search. Deterministic
 * and auditable: given the same text + allergens it always returns the same
 * verdict.
 */

/**
 * Maps a canonical allergen (lowercased, as stored in user_allergies) to the
 * set of words/phrases that imply its presence in an ingredient string.
 * Keys are matched case-insensitively; the canonical key itself is always
 * included implicitly.
 */
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanuts: ["peanut", "peanuts", "groundnut", "groundnuts", "moongphali", "arachis"],
  "tree nuts": [
    "tree nut",
    "tree nuts",
    "almond",
    "almonds",
    "cashew",
    "cashews",
    "kaju",
    "walnut",
    "walnuts",
    "pecan",
    "pecans",
    "pistachio",
    "pistachios",
    "pista",
    "hazelnut",
    "hazelnuts",
    "macadamia",
    "brazil nut",
    "praline",
    "marzipan",
    "nutella",
  ],
  dairy: [
    "dairy",
    "milk",
    "butter",
    "ghee",
    "cheese",
    "paneer",
    "cream",
    "curd",
    "yogurt",
    "yoghurt",
    "dahi",
    "khoya",
    "mawa",
    "malai",
    "lactose",
    "whey",
    "casein",
    "condensed milk",
    "buttermilk",
  ],
  gluten: [
    "gluten",
    "wheat",
    "atta",
    "maida",
    "barley",
    "rye",
    "semolina",
    "sooji",
    "rava",
    "flour",
    "bread",
    "naan",
    "roti",
    "paratha",
    "noodle",
    "noodles",
    "pasta",
    "seitan",
    "malt",
  ],
  eggs: ["egg", "eggs", "anda", "albumen", "mayonnaise", "mayo", "meringue"],
  shellfish: [
    "shellfish",
    "prawn",
    "prawns",
    "shrimp",
    "crab",
    "lobster",
    "crayfish",
    "scampi",
    "squid",
    "calamari",
    "oyster",
    "mussel",
    "clam",
    "scallop",
  ],
  soy: [
    "soy",
    "soya",
    "soybean",
    "soybeans",
    "tofu",
    "edamame",
    "tempeh",
    "miso",
    "soy sauce",
    "tamari",
  ],
  sesame: ["sesame", "til", "tahini", "gingelly", "benne"],
  // Common free-form allergies users may add via update_allergy that aren't in
  // the canonical onboarding list. Self-keyed entries still get word-boundary
  // matching + light plural handling below.
  mushrooms: ["mushroom", "mushrooms", "fungi", "shiitake", "button mushroom"],
  garlic: ["garlic", "lehsun", "lasun"],
  onion: ["onion", "onions", "pyaaz", "pyaz"],
};

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The list of keywords to scan for a given allergen: its synonym set if known,
 * otherwise the allergen word itself (+ a naive plural). Always lowercased.
 */
function keywordsFor(allergen: string): string[] {
  const key = allergen.trim().toLowerCase();
  if (ALLERGEN_SYNONYMS[key]) return ALLERGEN_SYNONYMS[key];
  // Unknown allergen — match the word itself and a simple plural/singular.
  const base = key;
  const variants = new Set<string>([base]);
  if (base.endsWith("s")) variants.add(base.slice(0, -1));
  else variants.add(`${base}s`);
  return [...variants];
}

/**
 * Scan free-form item text for any of the user's allergens. Returns the list of
 * canonical allergens whose keywords appear in the text (word-boundary match,
 * case-insensitive). Empty array = nothing detected.
 *
 * This is intentionally conservative: it errs toward flagging. A false positive
 * (over-blocking) is a safe failure for an allergy gate; a false negative is not.
 */
export function scanTextForAllergens(
  text: string,
  allergens: string[],
): string[] {
  if (!text || allergens.length === 0) return [];
  const haystack = text.toLowerCase();
  const hits: string[] = [];

  for (const allergen of allergens) {
    const keywords = keywordsFor(allergen);
    const found = keywords.some((kw) => {
      const escaped = escapeRegExp(kw.toLowerCase());
      // Word-boundary match so "milk" doesn't fire on "buttermilk-free" oddly,
      // but "buttermilk" (its own keyword) still matches. \b handles spaces,
      // punctuation, and string edges.
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      return re.test(haystack);
    });
    if (found) hits.push(allergen.trim().toLowerCase());
  }

  return hits;
}
