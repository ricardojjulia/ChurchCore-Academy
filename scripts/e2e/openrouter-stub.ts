import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DEFAULT_GRADER_MODEL } from "../../src/lib/ai-gateway";
import { AI_TASK_PROFILES } from "../../src/modules/ai-gateway/task-profiles";

// A deterministic, local-only stand-in for OpenRouter, started by scripts/e2e/run.ts so the e2e
// suite can drive the real AI gateway (catalog load, blind grading, selection, Postgres
// persistence, SSE streaming) without a network call, an API key, or spend. The app reaches it
// only through OPENROUTER_BASE_URL, which nothing outside the e2e runner sets.

/** Candidates and the score the stub grader gives each. Both clear every ask's quality floor. */
export const STUB_CANDIDATES = {
  "openai/e2e-strong": 9,
  "anthropic/e2e-steady": 7,
} as const;

const PROMPT_USD_PER_TOKEN = "0.000001";
const COMPLETION_USD_PER_TOKEN = "0.000002";

function catalogEntry(id: string) {
  return {
    id,
    name: id,
    created: Math.floor(Date.now() / 1000) - 10 * 86_400,
    context_length: 200_000,
    architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    pricing: { prompt: PROMPT_USD_PER_TOKEN, completion: COMPLETION_USD_PER_TOKEN },
    top_provider: { context_length: 200_000, max_completion_tokens: 32_000 },
    expiration_date: null,
  };
}

const evaluationCases = Object.values(AI_TASK_PROFILES).flatMap((profile) => profile.evaluationCases);

interface StubRequestBody {
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  stream?: boolean;
}

function readBody(request: IncomingMessage): Promise<StubRequestBody> {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}") as StubRequestBody);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function usage(promptTokens: number, completionTokens: number) {
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    cost: (promptTokens * Number(PROMPT_USD_PER_TOKEN)) + (completionTokens * Number(COMPLETION_USD_PER_TOKEN)),
  };
}

/** What the stub "model" says: the grader returns a verdict; candidates echo the required terms. */
function answer(body: StubRequestBody) {
  const model = body.model ?? "";
  const messages = body.messages ?? [];
  if (model === DEFAULT_GRADER_MODEL) {
    const graded = messages.map((message) => message.content).join("\n");
    const candidate = (Object.keys(STUB_CANDIDATES) as Array<keyof typeof STUB_CANDIDATES>)
      .find((id) => graded.includes(`[${id}]`));
    const score = candidate ? STUB_CANDIDATES[candidate] : 0;
    return { model, text: JSON.stringify({ score, rationale: "Deterministic e2e grade." }) };
  }
  const prompt = messages.find((message) => message.role === "user")?.content ?? "";
  const evaluationCase = evaluationCases.find((candidateCase) => candidateCase.prompt === prompt);
  // A routed HQ chat (auto-router or a selected model) is answered by the strongest stub model.
  const served = model in STUB_CANDIDATES ? model : "openai/e2e-strong";
  return {
    model: served,
    text: evaluationCase
      ? `[${served}] ${evaluationCase.requiredTerms.join(" ")}`
      : "Stub answer from the e2e OpenRouter stand-in.",
  };
}

export async function startOpenRouterStub(port = 0): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/api/v1/models") {
        const ids = [DEFAULT_GRADER_MODEL, ...Object.keys(STUB_CANDIDATES)];
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: ids.map(catalogEntry) }));
        return;
      }

      if (request.method === "POST" && request.url === "/api/v1/chat/completions") {
        const body = await readBody(request);
        const { model, text } = answer(body);

        if (body.stream) {
          response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
          response.write(": OPENROUTER PROCESSING\n\n");
          response.write(`data: ${JSON.stringify({ model, choices: [{ delta: { content: text } }] })}\n\n`);
          response.write(`data: ${JSON.stringify({ model, choices: [], usage: usage(120, 12) })}\n\n`);
          response.end("data: [DONE]\n\n");
          return;
        }

        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ model, choices: [{ message: { content: text } }], usage: usage(400, 60) }));
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Not found in the e2e OpenRouter stub." } }));
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Malformed request to the e2e OpenRouter stub." } }));
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const { port: bound } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${bound}/api/v1` };
}
