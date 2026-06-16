import { NextRequest } from "next/server";

function getUpstreamErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return "AI request failed.";
  }

  const error = (data as { error?: unknown }).error;

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  const message = (data as { message?: unknown }).message;
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  return "AI request failed.";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "AI council is unavailable in this environment." },
      {
        status: 503,
        headers: { "x-ai-error-message": "AI council is unavailable in this environment." },
      },
    );
  }

  const body = await request.json();

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const contentType = upstream.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "x-accel-buffering": "no",
      },
    });
  }

  const data = await upstream.json();
  if (!upstream.ok) {
    const message = getUpstreamErrorMessage(data);
    return Response.json(
      { error: message },
      {
        status: upstream.status,
        headers: { "x-ai-error-message": message },
      },
    );
  }

  return Response.json(data, { status: upstream.status });
}
