import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function handleApi<T>(handler: () => Promise<T>) {
  try {
    return jsonOk(await handler());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected API error.";
    const status = message.includes("not found") || message.includes("was not found") ? 404 : 500;
    return jsonError(message, status);
  }
}

