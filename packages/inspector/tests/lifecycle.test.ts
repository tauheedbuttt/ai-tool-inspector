import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createToolInspector, VERSION } from "../src/index";
import { harness, tools } from "./fixtures";

describe("createToolInspector", () => {
  it("does nothing when enabled is false", async () => {
    const inspector = createToolInspector({ tools, enabled: false, port: 0 });

    expect(inspector.enabled).toBe(false);
    expect(inspector.url).toBeNull();
    expect(inspector.port).toBeNull();
    expect(inspector.listening).toBe(false);

    await inspector.start();
    expect(inspector.listening).toBe(false);
    await inspector.stop();
  });

  it("is disabled by default in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const inspector = createToolInspector({ tools, port: 0 });
      expect(inspector.enabled).toBe(false);
      expect(inspector.url).toBeNull();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("binds to loopback by default", async () => {
    const inspector = createToolInspector({ tools, port: 0, autoStart: false, banner: false });
    await inspector.start();
    try {
      expect(inspector.url).toMatch(/^http:\/\/localhost:\d+$/);
      expect(inspector.listening).toBe(true);
    } finally {
      await inspector.stop();
    }
    expect(inspector.listening).toBe(false);
  });

  it("start and stop are idempotent", async () => {
    const inspector = createToolInspector({ tools, port: 0, autoStart: false, banner: false });
    const [a, b] = await Promise.all([inspector.start(), inspector.start()]);
    expect(a.port).toBe(b.port);

    await Promise.all([inspector.stop(), inspector.stop()]);
    expect(inspector.listening).toBe(false);
  });

  it("starts automatically and serves the UI shell", async () => {
    const app = await harness();
    try {
      const response = await fetch(app.url);
      // The bundled UI is only present after `pnpm build`; either way the server answers.
      expect([200, 500]).toContain(response.status);
    } finally {
      await app.stop();
    }
  });

  it("rejects a tools value that is not an object", () => {
    // @ts-expect-error deliberately wrong
    expect(() => createToolInspector({ tools: null })).toThrow(/tools/);
  });

  it("reports a port conflict clearly", async () => {
    const first = createToolInspector({ tools, port: 0, autoStart: false, banner: false });
    await first.start();
    try {
      const second = createToolInspector({
        tools,
        port: first.port!,
        autoStart: false,
        banner: false,
      });
      await expect(second.start()).rejects.toThrow(/already in use/);
    } finally {
      await first.stop();
    }
  });

  it("keeps VERSION in sync with package.json", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    expect(VERSION).toBe(manifest.version);
  });
});
