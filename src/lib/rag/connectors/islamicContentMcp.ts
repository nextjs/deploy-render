import crypto from "node:crypto";
import type { EvidenceCandidate, RetrievalQuery } from "@/lib/schemas/retrieval";
import type { RetrievalConnector } from "@/lib/rag/types";

const MCP_URL = process.env.ISLAMIC_CONTENT_MCP_URL ?? "https://mcp.islamiccontent.org/mcp";

type JsonRpcResponse = {
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type McpTool = {
  name: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; default?: unknown }>;
    required?: string[];
  };
};

function hashId(value: string): string {
  return `mcp-${crypto.createHash("sha256").update(value, "utf8").digest("hex").slice(0, 24)}`;
}

function parsePayload(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const dataLines = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (let index = dataLines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(dataLines[index]);
    } catch {}
  }

  return text;
}

async function post(
  body: Record<string, unknown>,
  timeoutMs = 10000
): Promise<{ response: Response; payload: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    return {
      response,
      payload: parsePayload(await response.text())
    };
  } finally {
    clearTimeout(timer);
  }
}

async function request(
  method: string,
  params: Record<string, unknown> = {}
): Promise<JsonRpcResponse> {
  const response = await post({
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  });

  if (!response.response.ok) {
    throw new Error(`Islamic Content MCP HTTP ${response.response.status}`);
  }

  const payload = response.payload as JsonRpcResponse | null;

  if (!payload || typeof payload !== "object") {
    throw new Error("Islamic Content MCP returned an unreadable response.");
  }

  if (payload.error) {
    throw new Error(
      `Islamic Content MCP ${method} error ${payload.error.code}: ${payload.error.message}`
    );
  }

  return payload;
}

function objects(value: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const seen = new Set<object>();

  const textKeys = [
    "text",
    "content",
    "description",
    "translation",
    "body",
    "snippet",
    "title"
  ];
  const originKeys = [
    "url",
    "sourceUrl",
    "link",
    "locator",
    "reference",
    "path",
    "id",
    "key"
  ];

  const firstString = (
    object: Record<string, unknown>,
    keys: string[]
  ): string | undefined => {
    for (const key of keys) {
      const item = object[key];
      if (typeof item === "string" && item.trim()) return item.trim();
    }
    return undefined;
  };

  const findNested = (
    current: unknown,
    keys: string[],
    depth: number
  ): string | undefined => {
    if (depth > 5 || current == null) return undefined;

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          return findNested(JSON.parse(trimmed), keys, depth + 1);
        } catch {}
      }
      return undefined;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        const result = findNested(item, keys, depth + 1);
        if (result) return result;
      }
      return undefined;
    }

    if (typeof current !== "object") return undefined;

    const object = current as Record<string, unknown>;
    return (
      firstString(object, keys) ??
      Object.values(object)
        .map((item) => findNested(item, keys, depth + 1))
        .find((result): result is string => Boolean(result))
    );
  };

  const visit = (
    current: unknown,
    depth: number,
    inheritedOrigin?: string
  ) => {
    if (depth > 8 || current == null) return;

    if (typeof current === "string") {
      const trimmed = current.trim();

      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          visit(JSON.parse(trimmed), depth + 1, inheritedOrigin);
        } catch {}
      } else if (inheritedOrigin && trimmed) {
        found.push({
          text: trimmed,
          locator: inheritedOrigin
        });
      }
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1, inheritedOrigin));
      return;
    }

    if (typeof current !== "object") return;

    const object = current as Record<string, unknown>;
    if (seen.has(object)) return;
    seen.add(object);

    const ownOrigin = firstString(object, originKeys);
    const origin = ownOrigin ?? inheritedOrigin;
    const text = firstString(object, textKeys);

    if (text && origin) {
      found.push({
        ...object,
        locator: ownOrigin ?? object.locator ?? origin
      });
    }

    Object.values(object).forEach((item) => {
      visit(item, depth + 1, origin);
    });

    // Some MCP payloads keep text in one nested object and the URL/reference
    // in a sibling or metadata object. Preserve that provenance relationship.
    if (text && !origin) {
      const nestedOrigin = findNested(object, originKeys, 4);
      if (nestedOrigin) {
        found.push({
          ...object,
          locator: nestedOrigin
        });
      }
    }
  };

  visit(value, 0);
  return found;
}

function stringField(
  object: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function inferType(
  object: Record<string, unknown>
): EvidenceCandidate["sourceType"] {
  const raw = (
    stringField(object, [
      "sourceType",
      "contentType",
      "type",
      "collection",
      "category"
    ]) ?? ""
  ).toLowerCase();

  const origin = (
    stringField(object, [
      "url",
      "sourceUrl",
      "link",
      "locator",
      "reference",
      "path"
    ]) ?? ""
  ).toLowerCase();

  const sourceHint = raw || origin;

  if (sourceHint.includes("quran") || sourceHint.includes("قرآن") || sourceHint.includes("islamenc.com/en/quran/")) return "quran";
  if (sourceHint.includes("hadith") || sourceHint.includes("حديث") || sourceHint.includes("hadeethenc.com/")) return "hadith";
  if (sourceHint.includes("tafsir") || sourceHint.includes("تفسير")) return "tafsir";
  if (sourceHint.includes("term") || sourceHint.includes("مصطلح") || sourceHint.includes("terminology")) return "terminology";
  if (
    sourceHint.includes("misconception") ||
    sourceHint.includes("question") ||
    sourceHint.includes("سؤال")
  ) {
    return "misconception";
  }
  if (sourceHint.includes("fiqh") || sourceHint.includes("فقه")) return "fiqh";
  if (sourceHint.includes("seerah") || sourceHint.includes("سيرة")) return "seerah";

  return "other_approved";
}

function buildArgs(
  tool: McpTool,
  query: RetrievalQuery
): Record<string, unknown> | null {
  const properties = tool.inputSchema?.properties ?? {};
  const required = tool.inputSchema?.required ?? [];

  const queryKey = ["query", "q", "search", "text"].find(
    (key) => properties[key]?.type === "string"
  );

  if (!queryKey) return null;

  const args: Record<string, unknown> = {
    [queryKey]: query.query
  };

  const languageKey = [
    "language",
    "lang",
    "languageCode",
    "locale"
  ].find((key) => properties[key]?.type === "string");

  if (languageKey) {
    args[languageKey] = query.queryLanguage;
  }

  const limitKey = [
    "limit",
    "topK",
    "top_k",
    "pageSize",
    "maxResults"
  ].find(
    (key) =>
      properties[key]?.type === "integer" ||
      properties[key]?.type === "number"
  );

  if (limitKey) {
    args[limitKey] = Math.min(query.topK * 2, 20);
  }

  const unsupported = required.filter(
    (key) => !(key in args) && properties[key]?.default === undefined
  );

  return unsupported.length === 0 ? args : null;
}

function normalize(
  object: Record<string, unknown>,
  query: RetrievalQuery,
  index: number
): EvidenceCandidate | null {
  const text = stringField(object, [
    "text",
    "content",
    "description",
    "translation",
    "body",
    "snippet"
  ]);

  const url = stringField(object, ["url", "sourceUrl", "link"]);
  const locator =
    stringField(object, ["locator", "reference", "path", "id", "key"]) ?? url;

  if (!text || !locator) return null;

  const sourceId =
    stringField(object, [
      "sourceId",
      "source_id",
      "collectionId",
      "collection"
    ]) ?? "islamic-content-mcp";

  const recordId =
    stringField(object, ["recordId", "record_id", "id", "key"]) ??
    hashId(`${sourceId}:${locator}:${text}`);

  const chunkId =
    stringField(object, ["chunkId", "chunk_id"]) ??
    hashId(`chunk:${recordId}`);

  const sourceName =
    stringField(object, ["sourceName", "source", "publisher"]) ??
    "Islamic Content MCP";

  const language =
    stringField(object, ["language", "lang", "languageCode"]) ??
    query.queryLanguage;

  const grading = stringField(object, ["grading", "grade", "authenticity"]);
  const finalLocator = grading
    ? `${locator} | grading=${grading}`
    : locator;

  return {
    id: hashId(`${sourceId}:${recordId}:${index}`),
    chunkId,
    recordId,
    sourceId,
    sourceType: inferType(object),
    sourceName,
    text,
    language,
    locator: finalLocator,
    url,
    score:
      typeof object.score === "number"
        ? object.score
        : typeof object.relevance === "number"
          ? object.relevance
          : 0.5,
    retrievalMethod: "keyword",
    conceptIds: []
  };
}

export class IslamicContentMcpConnector implements RetrievalConnector {
  readonly name = "islamic-content-mcp";

  async search(query: RetrievalQuery): Promise<EvidenceCandidate[]> {
    if (process.env.RASHID_DISABLE_MCP === "true") return [];

    const listed = await request("tools/list");
    const tools = Array.isArray(listed.result?.tools)
      ? (listed.result.tools as McpTool[])
      : [];

    const searchTool = tools.find((tool) => tool.name === "search");

    if (!searchTool) {
      throw new Error(
        "Documented Islamic Content MCP search tool is not advertised."
      );
    }

    const args = buildArgs(searchTool, query);

    if (!args) {
      throw new Error(
        "MCP search schema requires unsupported fields; no undocumented arguments were guessed."
      );
    }

    const result = await request("tools/call", {
      name: "search",
      arguments: args
    });

    if (result.result?.isError) {
      throw new Error("Islamic Content MCP search returned an error.");
    }

    return objects(
      result.result?.structuredContent ??
        result.result?.content ??
        result.result
    )
      .map((object, index) => normalize(object, query, index))
      .filter(
        (candidate): candidate is EvidenceCandidate => candidate !== null
      )
      .slice(0, Math.max(query.topK * 2, 8));
  }
}

export function createIslamicContentMcpConnector(): RetrievalConnector {
  return new IslamicContentMcpConnector();
}
