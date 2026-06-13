import { NextResponse } from "next/server";
import {
  AcademyAuthenticationError,
  AcademyAuthorizationError,
} from "@/modules/academy-auth/errors";

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

    if (error instanceof AcademyAuthenticationError) {
      return jsonError(message, 401);
    }

    if (
      error instanceof AcademyAuthorizationError ||
      message.includes("Forbidden")
    ) {
      return jsonError(message, 403);
    }

    if (message.includes("not found") || message.includes("was not found")) {
      return jsonError(message, 404);
    }

    if (
      message.startsWith("Invalid ") ||
      message.startsWith("Malformed ") ||
      message.includes(" is required") ||
      message.includes(" are required") ||
      message.includes(" must ")
    ) {
      return jsonError(message, 400);
    }

    return jsonError("Unexpected API error.", 500);
  }
}
