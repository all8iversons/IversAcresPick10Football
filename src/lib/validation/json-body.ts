import type { ZodType } from "zod";
import { HttpError } from "@/lib/http/errors";

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new HttpError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  return schema.parse(value);
}
