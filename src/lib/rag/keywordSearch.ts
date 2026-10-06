function normalizeArabic(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLocaleLowerCase();
}

const STOP_WORDS = new Set([
  "the",
  "is",
  "a",
  "an",
  "what",
  "does",
  "do",
  "about",
  "of",
  "in",
  "on",
  "to",
  "and",
  "or",
  "for",
  "with",
  "find",
  "explain",
  "simple",
  "terms",
  "topic",
  "test",
  "fixture",
]);    

function tokenize(value: string): string[] {
  return normalizeArabic(value)
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOP_WORDS.has(token));
}                     

export function keywordSearch(query: string, documents: string[]): number[] {
  const queryTokens = [...new Set(tokenize(query))];

  if (queryTokens.length === 0) {
    return documents.map(() => 0);
  }

  const queryPhrase = normalizeArabic(query).trim();

  return documents.map((document) => {
    const tokens = tokenize(document);
    const tokenSet = new Set(tokens);

    const overlap = queryTokens.filter((token) => tokenSet.has(token)).length;
    const coverage = overlap / queryTokens.length;

    const phraseBonus =
      queryPhrase && normalizeArabic(document).includes(queryPhrase)
        ? 0.25
        : 0;

    return Math.min(1, coverage * 0.75 + phraseBonus);
  });
}