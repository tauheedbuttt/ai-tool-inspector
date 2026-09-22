import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { harness, type Harness } from "./fixtures";
import type { Entry } from "../src/index";

let app: Harness;

beforeAll(async () => {
  app = await harness({ historyLimit: 3 });
});

afterAll(async () => {
  await app.stop();
});

describe("history", () => {
  it("records successes and failures newest first", async () => {
    await app.post("/api/tools/hello/execute", JSON.stringify({ name: "One" }));
    await app.post("/api/tools/boom/execute", JSON.stringify({ message: "nope" }));

    const { body } = await app.get<Entry[]>("/api/history");
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ tool: "boom", success: false });
    expect(body[1]).toMatchObject({ tool: "hello", success: true, result: { message: "Hello One" } });
    expect(body[1]!.input).toEqual({ name: "One" });
  });

  it("caps the number of entries kept", async () => {
    for (const name of ["A", "B", "C", "D"]) {
      await app.post("/api/tools/hello/execute", JSON.stringify({ name }));
    }

    const { body } = await app.get<Entry[]>("/api/history");
    expect(body).toHaveLength(3);
    expect(body.map((entry) => (entry.result as { message: string }).message)).toEqual([
      "Hello D",
      "Hello C",
      "Hello B",
    ]);
  });

  it("can be cleared", async () => {
    const response = await fetch(`${app.url}/api/history`, { method: "DELETE" });
    expect(response.status).toBe(200);

    const { body } = await app.get<Entry[]>("/api/history");
    expect(body).toEqual([]);
  });
});
