import { tool } from "ai";
import { z } from "zod";
import { createToolInspector } from "../src/index";
import type { Inspector, ToolSet } from "../src/index";

export const tools: ToolSet = {
  hello: tool({
    description: "Say hello",
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }) => ({ message: `Hello ${name}` }),
  }),

  add: tool({
    description: "Add two numbers",
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    execute: async ({ a, b }) => ({ result: a + b }),
  }),

  defaults: tool({
    description: "Shows generated defaults",
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().optional(),
      includeInactive: z.boolean().optional(),
      mode: z.enum(["fast", "slow"]).default("fast"),
      tags: z.array(z.string()).optional(),
    }),
    execute: async (input) => input,
  }),

  slow: tool({
    description: "Waits before resolving",
    inputSchema: z.object({ milliseconds: z.number() }),
    execute: async ({ milliseconds }) => {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
      return { waited: milliseconds };
    },
  }),

  boom: tool({
    description: "Always throws",
    inputSchema: z.object({ message: z.string() }),
    execute: async ({ message }): Promise<{ thrown: string }> => {
      throw new Error(message);
    },
  }),

  tricky: tool({
    description: "Returns values JSON.stringify cannot handle on its own",
    inputSchema: z.object({}),
    execute: async () => {
      const node: Record<string, unknown> = { name: "root", at: new Date("2026-01-01T00:00:00.000Z") };
      node.self = node;
      return { node, big: 10n, set: new Set([1, 2]), map: new Map([["k", "v"]]) };
    },
  }),

  clientSide: tool({
    description: "Has no execute function",
    inputSchema: z.object({ question: z.string() }),
    outputSchema: z.object({ confirmed: z.boolean() }),
  }),
};

export interface Harness {
  url: string;
  inspector: Inspector;
  get<T>(path: string): Promise<{ status: number; body: T }>;
  post<T>(path: string, body: string): Promise<{ status: number; body: T }>;
  stop(): Promise<void>;
}

/** Boots an inspector on an ephemeral port for a test file. */
export async function harness(overrides: Partial<Parameters<typeof createToolInspector>[0]> = {}): Promise<Harness> {
  const inspector = createToolInspector({
    tools,
    port: 0,
    autoStart: false,
    banner: false,
    ...overrides,
  });
  await inspector.start();

  const url = inspector.url!;

  async function call<T>(path: string, init?: RequestInit) {
    const response = await fetch(`${url}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  }

  return {
    url,
    inspector,
    get: (path) => call(path),
    post: (path, body) =>
      call(path, { method: "POST", headers: { "content-type": "application/json" }, body }),
    stop: () => inspector.stop(),
  };
}
