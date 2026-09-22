import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { harness, type Harness } from "./fixtures";
import type { Meta } from "../src/index";

let app: Harness;

beforeAll(async () => {
  app = await harness();
});

afterAll(async () => {
  await app.stop();
});

describe("GET /api/tools", () => {
  it("returns every registered tool", async () => {
    const { status, body } = await app.get<Meta[]>("/api/tools");
    expect(status).toBe(200);
    expect(body.map((tool) => tool.name)).toEqual([
      "hello",
      "add",
      "defaults",
      "slow",
      "boom",
      "tricky",
      "clientSide",
    ]);
  });

  it("exposes the description and a JSON Schema for each tool", async () => {
    const { body } = await app.get<Meta[]>("/api/tools");
    const hello = body.find((tool) => tool.name === "hello")!;

    expect(hello.description).toBe("Say hello");
    expect(hello.kind).toBe("function");
    expect(hello.executable).toBe(true);
    expect(hello.inputSchema).toMatchObject({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    });
  });

  it("generates editable default arguments from the schema", async () => {
    const { body } = await app.get<Meta[]>("/api/tools");
    const defaults = body.find((tool) => tool.name === "defaults")!;

    expect(defaults.defaultInput).toEqual({
      query: "",
      limit: 0,
      includeInactive: false,
      mode: "fast",
      tags: [""],
    });
  });

  it("marks tools without an execute function as not executable", async () => {
    const { body } = await app.get<Meta[]>("/api/tools");
    const clientSide = body.find((tool) => tool.name === "clientSide")!;

    expect(clientSide.executable).toBe(false);
    expect(clientSide.reason).toBe("no-execute");
    expect(clientSide.inputSchema).not.toBeNull();
  });

  it("reports the tool count on /api/info", async () => {
    const { body } = await app.get<{ toolCount: number; version: string }>("/api/info");
    expect(body.toolCount).toBe(7);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("404s on unknown API routes", async () => {
    const { status } = await app.get("/api/nope");
    expect(status).toBe(404);
  });
});
