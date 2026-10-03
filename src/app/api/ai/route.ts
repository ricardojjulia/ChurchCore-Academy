import { assertPlatformStaffWorkspaceAccess } from "@/modules/academy-auth/policy";
import { resolvePlatformRoles } from "@/modules/academy-auth/platform-request-context";
import { createAiGatewayFromEnv } from "@/lib/ai-gateway";
import type { AiGateway } from "@/modules/ai-gateway/gateway";
import { resolveHqTaskKind } from "@/modules/ai-gateway/task-profiles";
import { AiChatMessage, AiGatewayUnavailableError, AiProviderError } from "@/modules/ai-gateway/types";

// HQ agent council endpoint. The client names the agent; the server decides which model serves
// it (via the AI gateway's evaluated routing) — the client can no longer pick a model or a
// token budget.

const MAX_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 60_000;
const MAX_SYSTEM_CHARS = 20_000;
const MAX_TOTAL_CHARS = 300_000;

export interface AiRouteDependencies {
  roleResolver: () => Promise<string[]>;
  gatewayFactory: () => Pick<AiGateway, "stream">;
}

const defaultDependencies: AiRouteDependencies = {
  roleResolver: resolvePlatformRoles,
  gatewayFactory: createAiGatewayFromEnv,
};

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "x-ai-error-message": message } },
  );
}

interface ParsedAiRequest {
  agentId: string;
  mode?: string;
  messages: AiChatMessage[];
}

export function parseAiRequestBody(body: unknown): ParsedAiRequest {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  const { agentId, mode, system, messages } = body as Record<string, unknown>;

  if (typeof agentId !== "string" || !/^[a-z0-9_-]{1,40}$/.test(agentId)) {
    throw new Error("agentId is required.");
  }
  if (mode !== undefined && mode !== "council_review") {
    throw new Error("mode is not supported.");
  }
  if (system !== undefined && (typeof system !== "string" || system.length > MAX_SYSTEM_CHARS)) {
    throw new Error("system must be a string under the size limit.");
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new Error(`messages must contain 1-${MAX_MESSAGES} entries.`);
  }

  let total = typeof system === "string" ? system.length : 0;
  const parsed: AiChatMessage[] = messages.map((message) => {
    const { role, content } = (message ?? {}) as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) {
      throw new Error("Each message needs a user/assistant role and non-empty content.");
    }
    if (content.length > MAX_MESSAGE_CHARS) throw new Error("A message exceeds the size limit.");
    total += content.length;
    return { role, content };
  });
  if (total > MAX_TOTAL_CHARS) throw new Error("The conversation exceeds the size limit.");
  if (parsed.at(-1)?.role !== "user") throw new Error("The last message must be from the user.");

  return {
    agentId,
    mode: mode as string | undefined,
    messages: typeof system === "string" && system.trim()
      ? [{ role: "system", content: system }, ...parsed]
      : parsed,
  };
}

export async function handleAiRequest(request: Request, dependencies: AiRouteDependencies = defaultDependencies) {
  try {
    assertPlatformStaffWorkspaceAccess(await dependencies.roleResolver());
  } catch {
    return errorResponse("Forbidden platform staff access.", 403);
  }

  let parsed: ParsedAiRequest;
  try {
    parsed = parseAiRequestBody(await request.json().catch(() => null));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Invalid request.", 400);
  }

  try {
    const gateway = dependencies.gatewayFactory();
    const { body, model } = await gateway.stream({
      taskKind: resolveHqTaskKind(parsed.agentId, parsed.mode),
      messages: parsed.messages,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
        "x-ai-model": model,
      },
    });
  } catch (error) {
    if (error instanceof AiGatewayUnavailableError) {
      return errorResponse("AI council is unavailable in this environment.", 503);
    }
    if (error instanceof AiProviderError) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 502;
      return errorResponse(error.message, status);
    }
    return errorResponse("AI request failed.", 502);
  }
}

export async function POST(request: Request) {
  return handleAiRequest(request);
}
