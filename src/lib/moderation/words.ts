/**
 * Only words that are harsh by any standard: slurs and the worst profanity, in Hebrew and English. Mild words
 * ("shit", "חרא", "idiot") are deliberately not here: a Bar Mitzvah is not a school and a guest's joke should not
 * be blocked. Everything else goes to the moderation model, which looks at meaning and has its own thresholds.
 */

/** Hebrew entries are written with prefixes stripped (ה, ו, ב, ל, כ, ש may precede a word); phrases are space-separated. */
const HEBREW = [
  "זונה", "זונות", "שרמוטה", "שרמוטות", "כוס אמק", "כוסאמק", "כוסעמק", "כוס אמך", "כוס אמא שלך",
  "זין", "זיון", "לזיין", "מזדיין", "מזדיינת", "כושי", "ערבוש",
];

const ENGLISH = [
  "fuck", "fucker", "fuckers", "fucking", "fucked", "motherfucker", "motherfuckers", "cunt", "cunts", "nigger", "niggers", "nigga",
  "faggot", "faggots", "retard", "retarded", "whore", "whores", "slut", "sluts", "kike", "cocksucker",
];

/** Hebrew final letters become their regular form so a word matches wherever it stands. */
const FINAL: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Lowercase, no vowel marks or quotes, final letters unified, and repeated letters collapsed ("fuuuck", "זונההה"). */
export function normalise(word: string): string {
  return word
    .toLowerCase()
    .replace(/[֑-ׇ]/g, "")
    .replace(/[ךםןףץ]/g, (c) => FINAL[c])
    .replace(/(\p{L})\1+/gu, "$1");
}

const tokens = (text: string) => (text.normalize("NFKC").match(/[\p{L}]+/gu) ?? []).map(normalise);

const PREFIXES = new Set(["ו", "ה", "ב", "ל", "כ", "ש"]);

type Entry = { words: string[]; prefixes: boolean };
const entry = (phrase: string): Entry => {
  const words = tokens(phrase);
  // A short word may sit inside a harmless one ("מזונות", "מזין"), so only longer words take a prefix.
  return { words, prefixes: /[֐-׿]/.test(phrase) && words[0].length >= 4 };
};
const ENTRIES = [...HEBREW, ...ENGLISH].map(entry);

const matchesAt = (toks: string[], at: number, e: Entry): boolean => {
  const first = toks[at];
  const firstOk = first === e.words[0] || (e.prefixes && [...PREFIXES].some((p) => first === p + e.words[0] || first === p + p + e.words[0]));
  return firstOk && e.words.slice(1).every((w, i) => toks[at + 1 + i] === w);
};

/** The harsh words found in the text, as written in the list. Empty when there are none. */
export function harshWords(text: string): string[] {
  const toks = tokens(text);
  const found: string[] = [];
  for (const e of ENTRIES) {
    for (let i = 0; i < toks.length; i++) {
      if (matchesAt(toks, i, e)) {
        found.push(e.words.join(" "));
        break;
      }
    }
  }
  return found;
}
