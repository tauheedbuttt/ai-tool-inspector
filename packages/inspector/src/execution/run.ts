import type { Resolved } from "../schema/resolve";
import { message } from "../schema/resolve";
import type { Meta, Outcome, ToolSet } from "../types";
import { serialize } from "./serialize";

export interface Request_ {
  meta: Meta;
  tool: ToolSet[string];
  schema: Resolved;
  input: unknown;
  context: unknown;
  signal?: AbortSignal;
}

/** Validates input against the tool schema, then calls `execute` directly. */
export async function run({ meta, tool, schema, input, context, signal }: Request_): Promise<Outcome> {
  const started = performance.now();

  if (!meta.executable) {
    return {
      success: false,
      durationMs: 0,
      error: {
        kind: "not-executable",
        message:
          meta.reason === "provider-executed"
            ? `Tool "${meta.name}" is executed by the model provider and cannot be run locally.`
            : `Tool "${meta.name}" does not define an execute function and cannot be executed directly.`,
      },
    };
  }

  let args: unknown = input;
  if (schema.validate) {
    const outcome = await schema.validate(input);
    if (!outcome.ok) {
      return {
        success: false,
        durationMs: 0,
        error: {
          kind: "input",
          message: outcome.issues.length > 0 ? "Input does not match the tool schema." : outcome.message,
          issues: outcome.issues,
        },
      };
    }
    args = outcome.value;
  }

  const execute = (tool as { execute: (input: unknown, options: unknown) => unknown }).execute;

  try {
    const options = {
      toolCallId: `inspector-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      messages: [],
      context,
      ...(signal ? { abortSignal: signal } : {}),
    };
    const result = await drain(await execute(args, options));
    return { success: true, result: serialize(result), durationMs: elapsed(started) };
  } catch (error) {
    return {
      success: false,
      durationMs: elapsed(started),
      error: {
        kind: "execution",
        message: message(error),
        name: error instanceof Error ? error.name : typeof error,
        ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
      },
    };
  }
}

/** Streaming tools yield partial outputs; the inspector shows the final one. */
async function drain(result: unknown): Promise<unknown> {
  if (result == null || typeof result !== "object") return result;
  if (!(Symbol.asyncIterator in result)) return result;

  let last: unknown;
  for await (const chunk of result as AsyncIterable<unknown>) last = chunk;
  return last;
}

/** Whole milliseconds, with one decimal for fast tools so they do not report 0. */
function elapsed(started: number): number {
  const ms = performance.now() - started;
  return ms >= 100 ? Math.round(ms) : Math.round(ms * 10) / 10;
}
