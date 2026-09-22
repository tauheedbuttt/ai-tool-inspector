import type { IncomingMessage, ServerResponse } from "node:http";
import type { Registry } from "../tools/registry";
import type { History } from "../execution/history";
import { run } from "../execution/run";
import { serialize } from "../execution/serialize";
import type { Failure, Outcome } from "../types";
import { VERSION } from "../version";
import { root, serve } from "./assets";

const MAX_BODY = 1024 * 1024;

export interface Deps {
  registry: Registry;
  history: History;
  context: unknown;
}

export function router(deps: Deps) {
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

    try {
      if (pathname.startsWith("/api/")) {
        await api(deps, req, res, pathname);
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        send(res, 405, { error: { kind: "input", message: "Method not allowed" } });
        return;
      }
      const dir = await root();
      if (!dir) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("The Tool Inspector UI bundle is missing. Run `pnpm build` in the package.");
        return;
      }
      await serve(dir, pathname, res);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      send(res, 500, { error: fail("execution", error) });
    }
  };
}

async function api(deps: Deps, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const { registry, history } = deps;

  if (pathname === "/api/info" && req.method === "GET") {
    send(res, 200, { name: "ai-tool-inspector", version: VERSION, toolCount: registry.size });
    return;
  }

  if (pathname === "/api/tools" && req.method === "GET") {
    send(res, 200, await registry.list());
    return;
  }

  if (pathname === "/api/history") {
    if (req.method === "GET") {
      send(res, 200, history.list());
      return;
    }
    if (req.method === "DELETE") {
      history.clear();
      send(res, 200, []);
      return;
    }
  }

  const match = /^\/api\/tools\/([^/]+)\/execute$/.exec(pathname);
  if (match && req.method === "POST") {
    await execute(deps, req, res, decodeURIComponent(match[1]!));
    return;
  }

  send(res, 404, { error: { kind: "not-found", message: `No route for ${req.method} ${pathname}` } });
}

async function execute(deps: Deps, req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
  const record = await deps.registry.get(name);
  if (!record) {
    send(res, 404, {
      success: false,
      durationMs: 0,
      error: { kind: "not-found", message: `Unknown tool "${name}".` },
    } satisfies Outcome);
    return;
  }

  let body: string;
  try {
    body = await read(req);
  } catch (error) {
    send(res, 413, { success: false, durationMs: 0, error: fail("input", error) } satisfies Outcome);
    return;
  }

  let input: unknown;
  try {
    input = body.trim() === "" ? {} : JSON.parse(body);
  } catch (error) {
    send(res, 400, {
      success: false,
      durationMs: 0,
      error: { kind: "input", message: `Request body is not valid JSON: ${text(error)}` },
    } satisfies Outcome);
    return;
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  req.once("aborted", abort);

  const outcome = await run({
    meta: record.meta,
    tool: record.tool,
    schema: record.schema,
    input,
    context: deps.context,
    signal: controller.signal,
  });

  req.off("aborted", abort);

  const entry = deps.history.add({
    tool: name,
    input: serialize(input),
    at: new Date().toISOString(),
    durationMs: outcome.durationMs,
    success: outcome.success,
    ...(outcome.success ? { result: outcome.result } : { error: outcome.error }),
  });

  send(res, status(outcome), { ...outcome, historyId: entry.id });
}

/** Client mistakes get 4xx, a tool that throws is still a completed request. */
function status(outcome: Outcome): number {
  if (outcome.success) return 200;
  switch (outcome.error.kind) {
    case "input":
      return 400;
    case "not-found":
      return 404;
    case "not-executable":
      return 422;
    default:
      return 200;
  }
}

function read(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error(`Request body exceeds ${MAX_BODY} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, code: number, payload: unknown): void {
  const body = JSON.stringify(serialize(payload) ?? null);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function fail(kind: Failure["kind"], error: unknown): Failure {
  return {
    kind,
    message: text(error),
    ...(error instanceof Error ? { name: error.name } : {}),
  };
}

function text(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
