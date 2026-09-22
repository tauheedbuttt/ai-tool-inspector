import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { History } from "../execution/history";
import { Registry } from "../tools/registry";
import type { Inspector, Options } from "../types";
import { router } from "./router";

const DEFAULT_PORT = 4984;
const DEFAULT_HOST = "localhost";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Starts a local browser UI for manually executing AI SDK tools.
 * Disabled automatically when NODE_ENV is "production".
 */
export function createToolInspector(options: Options): Inspector {
  const enabled = options.enabled ?? process.env.NODE_ENV !== "production";
  if (!enabled) return disabled();

  const registry = new Registry(options.tools);
  const history = new History(options.historyLimit ?? 50);
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const banner = options.banner ?? true;

  const server = createServer((req, res) => {
    void router({ registry, history, context: options.context })(req, res);
  });
  server.on("clientError", (_error, socket) => socket.destroy());

  let starting: Promise<Inspector> | null = null;
  let stopping: Promise<void> | null = null;

  const inspector: Inspector = {
    enabled: true,
    get listening() {
      return server.listening;
    },
    get port() {
      const address = server.address();
      return address && typeof address === "object" ? (address as AddressInfo).port : null;
    },
    get url() {
      return inspector.port === null ? null : `http://${display(host)}:${inspector.port}`;
    },
    start() {
      stopping = null;
      starting ??= listen(server, port, host).then(() => {
        if (banner) announce(inspector.url!, registry.size, host);
        return inspector;
      });
      return starting;
    },
    stop() {
      starting = null;
      stopping ??= close(server);
      return stopping;
    },
  };

  if (options.autoStart ?? true) {
    inspector.start().catch((error: unknown) => {
      console.error(`[ai-tool-inspector] failed to start: ${text(error)}`);
    });
  }

  return inspector;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off("listening", onListening);
      reject(error.code === "EADDRINUSE" ? new Error(`Port ${port} is already in use.`, { cause: error }) : error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.closeAllConnections?.();
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function announce(url: string, count: number, host: string): void {
  const tools = `${count} tool${count === 1 ? "" : "s"} registered`;
  console.log(`\nAI SDK Tool Inspector\n${url}\n\n${tools}\n`);
  if (!LOOPBACK.has(host)) {
    console.warn(
      `[ai-tool-inspector] WARNING: bound to "${host}", which is reachable from other machines.\n` +
        `[ai-tool-inspector] Anyone who can reach this port can execute your tools with your app's credentials.\n`,
    );
  }
}

/** A no-op inspector so host code can call `createToolInspector` unconditionally. */
function disabled(): Inspector {
  const inspector: Inspector = {
    enabled: false,
    listening: false,
    url: null,
    port: null,
    start: () => Promise.resolve(inspector),
    stop: () => Promise.resolve(),
  };
  return inspector;
}

function display(host: string): string {
  if (host === "0.0.0.0" || host === "::") return "localhost";
  return host === "::1" ? "[::1]" : host;
}

function text(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
