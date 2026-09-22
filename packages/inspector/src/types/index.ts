import type { ToolSet } from "@ai-sdk/provider-utils";
import type { JSONSchema7 } from "./json-schema";

export type { JSONSchema7 } from "./json-schema";
export type { ToolSet } from "@ai-sdk/provider-utils";

/** Why a tool cannot be run from the inspector. */
export type Unrunnable = "no-execute" | "provider-executed";

/** Serializable description of a single registered tool. */
export interface Meta {
  name: string;
  description: string | null;
  /** AI SDK tool kind. `function` covers plain `tool({...})` definitions. */
  kind: "function" | "dynamic" | "provider";
  /** JSON Schema derived from the tool `inputSchema`, or null if not derivable. */
  inputSchema: JSONSchema7 | null;
  /** Ready-to-edit sample arguments generated from the schema. */
  defaultInput: Record<string, unknown>;
  /** False when the tool has no `execute` function, or is provider executed. */
  executable: boolean;
  /** Set when `executable` is false. */
  reason?: Unrunnable;
  /** Present when the schema could not be converted to JSON Schema. */
  schemaError?: string;
}

/** A structured error returned by the execute endpoint. */
export interface Failure {
  /** `input` means the request was rejected, `execution` means the tool threw. */
  kind: "input" | "execution" | "not-found" | "not-executable";
  message: string;
  name?: string;
  stack?: string;
  /** Per-field validation problems, when the schema rejected the input. */
  issues?: Issue[];
}

export interface Issue {
  path: string;
  message: string;
}

export interface Success {
  success: true;
  result: unknown;
  durationMs: number;
}

export interface Rejected {
  success: false;
  error: Failure;
  durationMs: number;
}

export type Outcome = Success | Rejected;

/** One past execution, kept in memory only. */
export interface Entry {
  id: string;
  tool: string;
  input: unknown;
  at: string;
  durationMs: number;
  success: boolean;
  result?: unknown;
  error?: Failure;
}

export interface Options {
  /** The AI SDK tools object to inspect. */
  tools: ToolSet;
  /** Port to listen on. Use 0 to pick a free port. Defaults to 4984. */
  port?: number;
  /** Interface to bind. Defaults to `localhost`. */
  host?: string;
  /** When false nothing is started. Defaults to `NODE_ENV !== "production"`. */
  enabled?: boolean;
  /** Start listening immediately. Defaults to true. */
  autoStart?: boolean;
  /** Print the startup banner. Defaults to true. */
  banner?: boolean;
  /** Value passed to each tool execution as `options.context`. */
  context?: unknown;
  /** Number of executions kept in the history panel. Defaults to 50. */
  historyLimit?: number;
}

export interface Inspector {
  /** The address the UI is served on, or null while not listening. */
  readonly url: string | null;
  /** The bound port, or null while not listening. */
  readonly port: number | null;
  /** False when the inspector was disabled through options. */
  readonly enabled: boolean;
  /** Whether the HTTP server is currently accepting connections. */
  readonly listening: boolean;
  /** Idempotent. Resolves once the server is listening, or immediately if disabled. */
  start(): Promise<Inspector>;
  /** Idempotent. Closes the server and resolves once it is fully shut down. */
  stop(): Promise<void>;
}
