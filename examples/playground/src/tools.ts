import { tool, type ToolSet } from "ai";
import { z } from "zod";

/** A deliberately small set of tools that covers every inspector behaviour. */
export const tools: ToolSet = {
  addNumbers: tool({
    description: "Add two numbers",
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ a, b }) => {
      return { result: a + b };
    },
  }),

  greetPerson: tool({
    description: "Generate a greeting",
    inputSchema: z.object({
      name: z.string(),
      excited: z.boolean().default(false),
    }),
    execute: async ({ name, excited }) => {
      return { greeting: excited ? `HELLO ${name.toUpperCase()}!` : `Hello ${name}` };
    },
  }),

  getUser: tool({
    description: "Return a fake user",
    inputSchema: z.object({
      id: z.number().int().positive(),
    }),
    execute: async ({ id }) => {
      return {
        id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
        roles: ["reader", "writer"],
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      };
    },
  }),

  delayedResponse: tool({
    description: "Wait and return a response",
    inputSchema: z.object({
      milliseconds: z.number().min(0).max(10_000),
    }),
    execute: async ({ milliseconds }) => {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
      return { waited: milliseconds };
    },
  }),

  failingTool: tool({
    description: "A tool intentionally designed to fail",
    inputSchema: z.object({
      message: z.string(),
    }),
    execute: async ({ message }): Promise<{ thrown: string }> => {
      throw new Error(message);
    },
  }),

  searchStatFin: tool({
    description: "Search a fake statistics catalogue and return a nested result",
    inputSchema: z.object({
      query: z.string().describe("Free text search"),
      limit: z.number().int().optional(),
      includeInactive: z.boolean().optional(),
    }),
    execute: async ({ query, limit = 10, includeInactive = false }) => {
      const results = Array.from({ length: Math.min(limit, 3) }, (_, index) => ({
        id: `table-${index + 1}`,
        title: `${query} (${index + 1})`,
        updated: "2026-01-15",
        active: includeInactive ? index % 2 === 0 : true,
      }));
      return { query, limit, includeInactive, count: results.length, results };
    },
  }),

  // Client-side tool: the model would handle this, so the inspector cannot run it.
  askForConfirmation: tool({
    description: "Ask the user to confirm an action. Handled on the client, not on the server.",
    inputSchema: z.object({
      question: z.string(),
    }),
    outputSchema: z.object({
      confirmed: z.boolean(),
    }),
  }),
};
