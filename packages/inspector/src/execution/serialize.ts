const MAX_DEPTH = 64;

/** Converts an arbitrary tool result into something `JSON.stringify` accepts. */
export function serialize(value: unknown): unknown {
  return walk(value, new WeakSet(), 0);
}

function walk(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null) return null;

  switch (typeof value) {
    case "undefined":
      return undefined;
    case "bigint":
      return `${value}n`;
    case "function":
      return `[Function: ${value.name || "anonymous"}]`;
    case "symbol":
      return value.toString();
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "string":
    case "boolean":
      return value;
  }

  const object = value as object;
  if (depth > MAX_DEPTH) return "[Max depth exceeded]";
  if (seen.has(object)) return "[Circular]";
  seen.add(object);

  try {
    if (object instanceof Date) return object.toISOString();
    if (object instanceof RegExp) return object.toString();
    if (object instanceof Error) return describe(object);
    if (object instanceof Map) {
      return Object.fromEntries([...object].map(([k, v]) => [String(k), walk(v, seen, depth + 1)]));
    }
    if (object instanceof Set) return [...object].map((entry) => walk(entry, seen, depth + 1));
    if (Array.isArray(object)) return object.map((entry) => walk(entry, seen, depth + 1) ?? null);
    if (ArrayBuffer.isView(object) || object instanceof ArrayBuffer) {
      return `[${object.constructor.name}]`;
    }

    const custom = (object as { toJSON?: unknown }).toJSON;
    if (typeof custom === "function") {
      return walk((custom as () => unknown).call(object), seen, depth + 1);
    }

    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(object)) {
      const converted = walk(entry, seen, depth + 1);
      if (converted !== undefined) out[key] = converted;
    }
    return out;
  } finally {
    seen.delete(object);
  }
}

function describe(error: Error): Record<string, unknown> {
  const out: Record<string, unknown> = { name: error.name, message: error.message };
  if (error.stack) out.stack = error.stack;
  if (error.cause !== undefined) out.cause = serialize(error.cause);
  return out;
}
