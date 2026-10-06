import { GoogleGenAI } from "@google/genai";

export type LlmGenerateOptions = {
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  responseJsonSchema?: Record<string, unknown>;
  temperature?: number;
};

export type LlmClient = {
  generate: (prompt: string, options?: LlmGenerateOptions) => Promise<string>;
};

const DEFAULT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
];

function getModels(): string[] {
  const configured = process.env.LLM_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  if (configured?.length) return configured;

  const legacyModel = process.env.LLM_MODEL?.trim();
  if (legacyModel) return [legacyModel];

  return DEFAULT_MODELS;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isFallbackEligible(error: unknown): boolean {
  const message = errorText(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("503") ||
    message.includes("service unavailable") ||
    message.includes("unavailable") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("model not found") ||
    message.includes("not found") ||
    message.includes("unexpected model name format")
  );
}

export function getLlmClient(): LlmClient {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = getModels();

  return {
    async generate(prompt, options = {}) {
      const failures: string[] = [];

      for (let index = 0; index < models.length; index++) {
        const model = models[index];

        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: options.systemInstruction,
              responseMimeType: options.responseMimeType,
              responseJsonSchema: options.responseJsonSchema,
              temperature: options.temperature,
            },
          });

          const text = response.text;
          if (!text) {
            throw new Error(`Gemini model ${model} returned an empty response.`);
          }

          if (index > 0) {
            console.warn(`LLM fallback succeeded with ${model} after ${index} failed model(s).`);
          }

          return text;
        } catch (error) {
          const message = errorText(error);
          failures.push(`${model}: ${message}`);

          const hasNextModel = index < models.length - 1;
          if (!hasNextModel || !isFallbackEligible(error)) {
            throw error;
          }

          console.warn(`LLM model ${model} unavailable; trying fallback model.`);
        }
      }

      throw new Error(`All configured LLM models failed: ${failures.join(" | ")}`);
    },
  };
}
