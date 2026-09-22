import { asSchema } from "@ai-sdk/provider-utils";
import type { Issue } from "../types";
import type { JSONSchema7 } from "../types/json-schema";

/** A normalised view of an AI SDK `inputSchema`. */
export interface Resolved {
  jsonSchema: JSONSchema7 | null;
  error?: string;
  validate?: (value: unknown) => Promise<{ ok: true; value: unknown } | { ok: false; issues: Issue[]; message: string }>;
}

/** Converts any AI SDK schema flavour (Zod, Standard Schema, JSON Schema) into JSON Schema. */
export async function resolve(input: unknown): Promise<Resolved> {
  if (input == null) return { jsonSchema: null, error: "Tool has no inputSchema." };

  let schema: ReturnType<typeof asSchema>;
  try {
    schema = asSchema(input as Parameters<typeof asSchema>[0]);
  } catch (error) {
    return { jsonSchema: null, error: message(error) };
  }

  const validate = schema.validate
    ? async (value: unknown) => toOutcome(await schema.validate!(value))
    : undefined;

  try {
    const jsonSchema = (await schema.jsonSchema) as JSONSchema7;
    return validate ? { jsonSchema, validate } : { jsonSchema };
  } catch (error) {
    return validate
      ? { jsonSchema: null, error: message(error), validate }
      : { jsonSchema: null, error: message(error) };
  }
}

type Outcome = { ok: true; value: unknown } | { ok: false; issues: Issue[]; message: string };

function toOutcome(result: { success: boolean; value?: unknown; error?: unknown }): Outcome {
  if (result.success) return { ok: true, value: result.value };
  return { ok: false, issues: issues(result.error), message: message(result.error) };
}

/** Pulls per-field problems out of a Zod-style error, walking `cause` chains. */
function issues(error: unknown): Issue[] {
  for (let current = error, depth = 0; current != null && depth < 5; depth++) {
    const raw = (current as { issues?: unknown }).issues;
    if (Array.isArray(raw)) {
      return raw.map((issue) => {
        const path = (issue as { path?: unknown[] }).path ?? [];
        return {
          path: Array.isArray(path) && path.length > 0 ? path.join(".") : "(root)",
          message: String((issue as { message?: unknown }).message ?? "Invalid value"),
        };
      });
    }
    current = (current as { cause?: unknown }).cause;
  }
  return [];
}

export function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}
