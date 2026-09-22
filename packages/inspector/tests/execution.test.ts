import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { harness, type Harness } from "./fixtures";
import type { Outcome } from "../src/index";

let app: Harness;

beforeAll(async () => {
  app = await harness();
});

afterAll(async () => {
  await app.stop();
});

describe("POST /api/tools/:name/execute", () => {
  it("runs a tool and returns its result", async () => {
    const { status, body } = await app.post<Outcome>(
      "/api/tools/hello/execute",
      JSON.stringify({ name: "Tauheed" }),
    );

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.success && body.result).toEqual({ message: "Hello Tauheed" });
  });

  it("reports the execution duration", async () => {
    const { body } = await app.post<Outcome>(
      "/api/tools/slow/execute",
      JSON.stringify({ milliseconds: 120 }),
    );

    expect(body.success).toBe(true);
    expect(body.durationMs).toBeGreaterThanOrEqual(100);
  });

  it("keeps multiple tools independent", async () => {
    const add = await app.post<Outcome>("/api/tools/add/execute", JSON.stringify({ a: 10, b: 32 }));
    const hello = await app.post<Outcome>("/api/tools/hello/execute", JSON.stringify({ name: "Ada" }));

    expect(add.body.success && add.body.result).toEqual({ result: 42 });
    expect(hello.body.success && hello.body.result).toEqual({ message: "Hello Ada" });
  });

  it("applies schema defaults before calling the tool", async () => {
    const { body } = await app.post<Outcome>(
      "/api/tools/defaults/execute",
      JSON.stringify({ query: "finland" }),
    );

    expect(body.success && body.result).toMatchObject({ query: "finland", mode: "fast" });
  });

  it("rejects malformed JSON with a 400 and a readable message", async () => {
    const { status, body } = await app.post<Outcome>("/api/tools/hello/execute", '{ "name":');

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(!body.success && body.error.kind).toBe("input");
    expect(!body.success && body.error.message).toMatch(/not valid JSON/i);
  });

  it("returns per-field issues when the input does not match the schema", async () => {
    const { status, body } = await app.post<Outcome>(
      "/api/tools/add/execute",
      JSON.stringify({ a: "hello", b: 10 }),
    );

    expect(status).toBe(400);
    expect(body.success).toBe(false);
    if (body.success) throw new Error("expected failure");
    expect(body.error.kind).toBe("input");
    expect(body.error.issues).toEqual([
      { path: "a", message: expect.stringContaining("expected number") },
    ]);
  });

  it("returns a structured error when the tool throws", async () => {
    const { status, body } = await app.post<Outcome>(
      "/api/tools/boom/execute",
      JSON.stringify({ message: "Database connection failed" }),
    );

    expect(status).toBe(200);
    expect(body.success).toBe(false);
    if (body.success) throw new Error("expected failure");
    expect(body.error.kind).toBe("execution");
    expect(body.error.name).toBe("Error");
    expect(body.error.message).toBe("Database connection failed");
    expect(body.error.stack).toContain("Error: Database connection failed");
  });

  it("refuses to run a tool without an execute function instead of crashing", async () => {
    const { status, body } = await app.post<Outcome>(
      "/api/tools/clientSide/execute",
      JSON.stringify({ question: "ok?" }),
    );

    expect(status).toBe(422);
    expect(body.success).toBe(false);
    if (body.success) throw new Error("expected failure");
    expect(body.error.kind).toBe("not-executable");
    expect(body.error.message).toMatch(/does not define an execute function/);

    const alive = await app.get("/api/tools");
    expect(alive.status).toBe(200);
  });

  it("404s for an unknown tool", async () => {
    const { status, body } = await app.post<Outcome>("/api/tools/missing/execute", "{}");

    expect(status).toBe(404);
    expect(!body.success && body.error.kind).toBe("not-found");
  });

  it("serialises results that JSON.stringify cannot handle", async () => {
    const { body } = await app.post<Outcome>("/api/tools/tricky/execute", "{}");

    expect(body.success).toBe(true);
    expect(body.success && body.result).toEqual({
      node: { name: "root", at: "2026-01-01T00:00:00.000Z", self: "[Circular]" },
      big: "10n",
      set: [1, 2],
      map: { k: "v" },
    });
  });

  it("treats an empty body as empty arguments", async () => {
    const { status, body } = await app.post<Outcome>("/api/tools/tricky/execute", "");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});
