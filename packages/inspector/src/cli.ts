#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createToolInspector } from "./server";
import type { ToolSet } from "./types";
import { VERSION } from "./version";

const USAGE = `ai-tool-inspector ${VERSION}

Loads a module that exports an AI SDK tools object and serves the inspector UI.

  npx ai-tool-inspector <module> [options]

Arguments
  <module>              Path to a module exporting \`tools\` (named or default).

Options
  --port <number>       Port to listen on (default 4984)
  --host <host>         Interface to bind (default localhost)
  --export <name>       Named export to read instead of \`tools\`
  -h, --help            Show this message
  -v, --version         Print the version

Notes
  The CLI can only load tools it can import. ESM and CJS are supported out of
  the box. For a TypeScript module, run it through a loader, for example:

    npx tsx node_modules/ai-tool-inspector/dist/cli.js ./src/tools.ts

  For tools that live inside a running application, use the programmatic API
  instead: createToolInspector({ tools }).
`;

main().catch((error: unknown) => {
  console.error(`ai-tool-inspector: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log(USAGE);
    return;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    console.log(VERSION);
    return;
  }

  const { entry, flags } = parse(argv);
  if (!entry) throw new Error("Missing <module> argument. Run with --help for usage.");

  const module_ = (await import(pathToFileURL(resolve(entry)).href)) as Record<string, unknown>;
  const tools = pick(module_, flags.export ?? "tools");
  if (!tools) {
    throw new Error(
      `"${entry}" does not export an object named "${flags.export ?? "tools"}" (and has no usable default export).`,
    );
  }

  const inspector = createToolInspector({
    tools,
    autoStart: false,
    ...(flags.port !== undefined ? { port: flags.port } : {}),
    ...(flags.host !== undefined ? { host: flags.host } : {}),
  });
  await inspector.start();
  process.on("SIGINT", () => void inspector.stop().then(() => process.exit(0)));
}

function pick(module_: Record<string, unknown>, name: string): ToolSet | null {
  const candidates = [module_[name], (module_.default as Record<string, unknown> | undefined)?.[name], module_.default];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && Object.keys(candidate).length > 0) {
      return candidate as ToolSet;
    }
  }
  return null;
}

function parse(argv: string[]): { entry: string | null; flags: { port?: number; host?: string; export?: string } } {
  let entry: string | null = null;
  const flags: { port?: number; host?: string; export?: string } = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--port") flags.port = Number(argv[++i]);
    else if (arg === "--host") flags.host = argv[++i];
    else if (arg === "--export") flags.export = argv[++i];
    else if (!arg.startsWith("-")) entry ??= arg;
  }

  if (flags.port !== undefined && !Number.isInteger(flags.port)) throw new Error("--port must be an integer.");
  return { entry, flags };
}
