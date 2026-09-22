import type { JSONSchema7 } from "../types/json-schema";

const MAX_DEPTH = 5;

/** Builds an editable starter object for a tool's JSON Schema. */
export function sample(schema: JSONSchema7 | null): Record<string, unknown> {
  if (!schema) return {};
  const root = deref(schema, schema, 0);
  const object = pickObject(root, schema, 0);
  if (!object?.properties) return {};

  const required = new Set(object.required ?? []);
  const names = Object.keys(object.properties);
  const ordered = [...names.filter((n) => required.has(n)), ...names.filter((n) => !required.has(n))];

  const out: Record<string, unknown> = {};
  for (const name of ordered) {
    const property = object.properties[name];
    if (property) out[name] = value(property, schema, 1);
  }
  return out;
}

/** Finds the object-shaped branch of a schema, looking through anyOf/oneOf/allOf. */
function pickObject(schema: JSONSchema7, root: JSONSchema7, depth: number): JSONSchema7 | null {
  if (schema.properties) return schema;
  if (depth >= MAX_DEPTH) return null;
  for (const branch of branches(schema)) {
    const found = pickObject(deref(branch, root, depth), root, depth + 1);
    if (found) return found;
  }
  return null;
}

function value(schema: JSONSchema7, root: JSONSchema7, depth: number): unknown {
  if (depth > MAX_DEPTH) return null;
  const node = deref(schema, root, depth);

  if ("default" in node) return node.default;
  if ("const" in node) return node.const;
  if (Array.isArray(node.enum) && node.enum.length > 0) return node.enum[0];
  if (Array.isArray(node.examples) && node.examples.length > 0) return node.examples[0];

  const branch = branches(node)[0];
  if (branch && !node.type) return value(branch, root, depth + 1);

  switch (type(node)) {
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "array": {
      const items = Array.isArray(node.items) ? node.items[0] : node.items;
      return items ? [value(items, root, depth + 1)] : [];
    }
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [name, property] of Object.entries(node.properties ?? {})) {
        out[name] = value(property, root, depth + 1);
      }
      return out;
    }
    default:
      return null;
  }
}

function type(schema: JSONSchema7): string | undefined {
  const raw = schema.type;
  if (Array.isArray(raw)) return raw.find((entry) => entry !== "null") ?? raw[0];
  return raw;
}

function branches(schema: JSONSchema7): JSONSchema7[] {
  return [...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])];
}

/** Resolves a local `#/...` pointer against the root document. */
function deref(schema: JSONSchema7, root: JSONSchema7, depth: number): JSONSchema7 {
  if (!schema.$ref || depth > MAX_DEPTH) return schema;
  if (!schema.$ref.startsWith("#")) return schema;

  let node: unknown = root;
  for (const segment of schema.$ref.slice(1).split("/").filter(Boolean)) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (typeof node !== "object" || node === null) return schema;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "object" && node !== null ? (node as JSONSchema7) : schema;
}
