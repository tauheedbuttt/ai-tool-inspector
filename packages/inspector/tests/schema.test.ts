import { describe, expect, it } from "vitest";
import { jsonSchema } from "ai";
import { z } from "zod";
import { resolve } from "../src/schema/resolve";
import { sample } from "../src/schema/sample";

describe("schema resolution", () => {
  it("converts a Zod schema to JSON Schema", async () => {
    const resolved = await resolve(z.object({ a: z.string() }));
    expect(resolved.jsonSchema).toMatchObject({ type: "object", required: ["a"] });
    expect(resolved.validate).toBeTypeOf("function");
  });

  it("accepts a plain JSON Schema", async () => {
    const resolved = await resolve(jsonSchema({ type: "object", properties: { a: { type: "string" } } }));
    expect(resolved.jsonSchema).toMatchObject({ properties: { a: { type: "string" } } });
  });

  it("reports a missing schema instead of throwing", async () => {
    const resolved = await resolve(undefined);
    expect(resolved.jsonSchema).toBeNull();
    expect(resolved.error).toMatch(/inputSchema/);
  });

  it("surfaces validation issues with field paths", async () => {
    const resolved = await resolve(z.object({ nested: z.object({ n: z.number() }) }));
    const outcome = await resolved.validate!({ nested: { n: "x" } });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.issues[0]).toMatchObject({ path: "nested.n" });
  });
});

describe("sample generation", () => {
  it("returns an empty object for a missing schema", () => {
    expect(sample(null)).toEqual({});
  });

  it("puts required properties first", () => {
    const generated = sample({
      type: "object",
      properties: { b: { type: "string" }, a: { type: "number" } },
      required: ["a"],
    });
    expect(Object.keys(generated)).toEqual(["a", "b"]);
  });

  it("uses defaults, consts and enum members", () => {
    const generated = sample({
      type: "object",
      properties: {
        withDefault: { type: "number", default: 10 },
        withEnum: { type: "string", enum: ["fast", "slow"] },
        withConst: { const: "fixed" },
      },
    });
    expect(generated).toEqual({ withDefault: 10, withEnum: "fast", withConst: "fixed" });
  });

  it("follows local $ref pointers without looping forever", () => {
    const generated = sample({
      type: "object",
      properties: { child: { $ref: "#/$defs/node" } },
      $defs: { node: { type: "object", properties: { child: { $ref: "#/$defs/node" } } } },
    });
    expect(generated).toHaveProperty("child");
  });

  it("handles arrays, nested objects and nullable unions", () => {
    const generated = sample({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
        nested: { type: "object", properties: { flag: { type: "boolean" } } },
        maybe: { type: ["string", "null"] },
      },
    });
    expect(generated).toEqual({ tags: [""], nested: { flag: false }, maybe: "" });
  });
});
