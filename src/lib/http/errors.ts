import { ZodError } from "zod";
import { jsonError } from "./responses";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonError(error.status, error.code, error.message);
  }
  if (error instanceof ZodError) {
    return jsonError(
      422,
      "INVALID_REQUEST",
      "The request is invalid.",
      error.issues.map(({ path, message }) => ({ path, message })),
    );
  }

  console.error("Unhandled request error", error);
  return jsonError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}
