export interface Meta {
  name: string;
  description: string | null;
  kind: "function" | "dynamic" | "provider";
  inputSchema: Record<string, unknown> | null;
  defaultInput: Record<string, unknown>;
  executable: boolean;
  reason?: "no-execute" | "provider-executed";
  schemaError?: string;
}

export interface Issue {
  path: string;
  message: string;
}

export interface Failure {
  kind: "input" | "execution" | "not-found" | "not-executable";
  message: string;
  name?: string;
  stack?: string;
  issues?: Issue[];
}

export type Outcome =
  | { success: true; result: unknown; durationMs: number }
  | { success: false; error: Failure; durationMs: number };

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

export interface Info {
  name: string;
  version: string;
  toolCount: number;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return (await response.json()) as T;
}

export const api = {
  info: () => get<Info>("/api/info"),
  tools: () => get<Meta[]>("/api/tools"),
  history: () => get<Entry[]>("/api/history"),

  async clearHistory(): Promise<Entry[]> {
    const response = await fetch("/api/history", { method: "DELETE" });
    return response.ok ? [] : get<Entry[]>("/api/history");
  },

  async execute(name: string, input: string, signal?: AbortSignal): Promise<Outcome> {
    const response = await fetch(`/api/tools/${encodeURIComponent(name)}/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: input,
      ...(signal ? { signal } : {}),
    });
    return (await response.json()) as Outcome;
  },
};
