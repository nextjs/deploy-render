import { routeQuestion } from "../src/lib/ai/router";
import type { RouterInput } from "../src/lib/schemas/router";

type TestCase = {
  name: string;
  input: RouterInput;
  expected: {
    queryLanguage?: string;
    contentLevel?: "A" | "B" | "C" | "D";
    route: "LOOKUP" | "EXPLAIN" | "DISAGREEMENT" | "REFERRAL" | "CLARIFY";
    ambiguous?: boolean;
    personalRuling?: boolean;
  };
};

const tests: TestCase[] = [
  {
    name: "Arabic direct definition",
    input: { question: "ما معنى التوحيد؟" },
    expected: { queryLanguage: "ar", contentLevel: "A", route: "LOOKUP", ambiguous: false },
  },
  {
    name: "English explanation",
    input: { question: "Why do Muslims fast during Ramadan?" },
    expected: { queryLanguage: "en", contentLevel: "B", route: "EXPLAIN", ambiguous: false },
  },
  {
    name: "French explanation",
    input: { question: "Pourquoi les musulmans jeûnent-ils pendant le Ramadan ?" },
    expected: { queryLanguage: "fr", contentLevel: "B", route: "EXPLAIN", ambiguous: false },
  },
  {
    name: "Disagreement / objection",
    input: { question: "Some people say this verse contradicts freedom of religion. How is that understood?" },
    expected: { queryLanguage: "en", contentLevel: "C", route: "DISAGREEMENT", ambiguous: false },
  },
  {
    name: "Personal ruling",
    input: { question: "أنا في دولة معينة ولدي ظروف خاصة في زواجي. هل يجوز لي شخصياً أن أفعل كذا؟" },
    expected: { queryLanguage: "ar", contentLevel: "D", route: "REFERRAL", personalRuling: true },
  },
  {
    name: "Ambiguous question",
    input: { question: "لماذا فعلوا ذلك؟" },
    expected: { queryLanguage: "ar", route: "CLARIFY", ambiguous: true },
  },
  {
    name: "Explicit objection",
    input: { question: "Why does Islam ban this? That makes no sense." },
    expected: { queryLanguage: "en", contentLevel: "C", route: "DISAGREEMENT", ambiguous: false },
  },
  {
    name: "Hostile tone but explanatory intent",
    input: { question: "This religion is stupid. Why do Muslims fast during Ramadan?" },
    expected: { queryLanguage: "en", contentLevel: "B", route: "EXPLAIN", ambiguous: false },
  },
  {
    name: "Explicit challenge requiring disagreement handling",
    input: { question: "Islam bans this, but that makes no sense. How can that be justified?" },
    expected: { queryLanguage: "en", contentLevel: "C", route: "DISAGREEMENT", ambiguous: false },
  },
];

async function main() {
  let passed = 0;

  for (const test of tests) {
    console.log(`\n→ ${test.name}`);
    try {
      const result = await routeQuestion(test.input);
      console.log(JSON.stringify(result, null, 2));
  
      const failures: string[] = [];
      for (const [key, expectedValue] of Object.entries(test.expected)) {
        const actualValue = result[key as keyof typeof result];
        if (actualValue !== expectedValue) {
          failures.push(`${key}: expected ${String(expectedValue)}, got ${String(actualValue)}`);
        }
      }
  
      if (failures.length) {
        console.error("  ✗", failures.join("; "));
      } else {
        passed++;
        console.log("  ✓ expected routing");
      }
    } catch (error) {
      console.error("  ✗", error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log(`\nRouter smoke test: ${passed}/${tests.length} passed.`);

  if (passed !== tests.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("\n✗ Router smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
