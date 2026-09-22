import type { Meta, ToolSet } from "../types";
import { resolve, type Resolved } from "../schema/resolve";
import { sample } from "../schema/sample";

interface Record_ {
  meta: Meta;
  tool: ToolSet[string];
  schema: Resolved;
}

/** Reads an AI SDK tools object once and caches the derived metadata. */
export class Registry {
  readonly #tools: ToolSet;
  #records: Map<string, Record_> | null = null;
  #pending: Promise<Map<string, Record_>> | null = null;

  constructor(tools: ToolSet) {
    if (tools == null || typeof tools !== "object") {
      throw new TypeError("createToolInspector: `tools` must be an AI SDK tools object.");
    }
    this.#tools = tools;
  }

  get names(): string[] {
    return Object.keys(this.#tools);
  }

  get size(): number {
    return this.names.length;
  }

  async list(): Promise<Meta[]> {
    return [...(await this.#load()).values()].map((record) => record.meta);
  }

  async get(name: string): Promise<Record_ | undefined> {
    return (await this.#load()).get(name);
  }

  #load(): Promise<Map<string, Record_>> {
    if (this.#records) return Promise.resolve(this.#records);
    this.#pending ??= build(this.#tools).then((records) => {
      this.#records = records;
      return records;
    });
    return this.#pending;
  }
}

async function build(tools: ToolSet): Promise<Map<string, Record_>> {
  const records = new Map<string, Record_>();

  for (const [name, tool] of Object.entries(tools)) {
    if (tool == null || typeof tool !== "object") continue;

    const schema = await resolve((tool as { inputSchema?: unknown }).inputSchema);
    const providerExecuted = (tool as { isProviderExecuted?: boolean }).isProviderExecuted === true;
    const hasExecute = typeof (tool as { execute?: unknown }).execute === "function";

    const meta: Meta = {
      name,
      description: describe(tool),
      kind: kind(tool),
      inputSchema: schema.jsonSchema,
      defaultInput: sample(schema.jsonSchema),
      executable: hasExecute && !providerExecuted,
    };
    if (!meta.executable) meta.reason = providerExecuted ? "provider-executed" : "no-execute";
    if (schema.error) meta.schemaError = schema.error;

    records.set(name, { meta, tool, schema });
  }

  return records;
}

/** Tool descriptions may be a function of the execution context, which the inspector does not have. */
function describe(tool: unknown): string | null {
  const raw = (tool as { description?: unknown }).description;
  if (typeof raw === "string") return raw;
  if (typeof raw === "function") return "(description is computed at call time)";
  return null;
}

function kind(tool: unknown): Meta["kind"] {
  const raw = (tool as { type?: unknown }).type;
  return raw === "dynamic" || raw === "provider" ? raw : "function";
}
