# AI SDK Tool Inspector

[![npm](https://img.shields.io/npm/v/ai-tool-inspector?color=7dd3a0&label=npm)](https://www.npmjs.com/package/ai-tool-inspector)
[![CI](https://github.com/tauheedbuttt/ai-tool-inspector/actions/workflows/ci.yml/badge.svg)](https://github.com/tauheedbuttt/ai-tool-inspector/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/ai-tool-inspector?color=7dd3a0)](https://github.com/tauheedbuttt/ai-tool-inspector/blob/main/LICENSE)

A tiny local browser inspector for manually executing [Vercel AI SDK](https://sdk.vercel.ai) tools.

No model. No agent. No `generateText`, `streamText` or `useChat`. You hand it your existing tools
object, it serves a small page on `localhost`, and you run the tools by hand.

<p align="center">
  <img src="https://raw.githubusercontent.com/tauheedbuttt/ai-tool-inspector/main/docs/screenshot.png" alt="The Tool Inspector UI, showing a tool list, a JSON argument editor and a result panel" width="900">
</p>

```ts
import { tool } from "ai";
import { z } from "zod";
import { createToolInspector } from "ai-tool-inspector";

const tools = {
  hello: tool({
    description: "Say hello",
    inputSchema: z.object({
      name: z.string(),
    }),
    execute: async ({ name }) => ({
      message: `Hello ${name}`,
    }),
  }),
};

createToolInspector({
  tools,
});
```

Open <http://localhost:4984>.

---

## Why it exists

Tools are ordinary functions, but during development they are usually only reachable through a model.
Checking that one returns the right shape means writing a prompt, paying for a completion, and hoping
the model decides to call it. If it does not, you learn nothing.

The inspector removes the model from that loop. It reads your tools object, renders each tool's input
schema, and calls `execute` directly with the arguments you type. What you see is what the model would
have received.

## What it does

- Lists every tool in the object you pass, with its description.
- Converts each `inputSchema` (Zod, Standard Schema, or plain JSON Schema) into JSON Schema and shows it.
- Generates editable starter arguments from that schema.
- Validates your JSON, then validates it against the tool schema, before anything runs.
- Calls `execute` directly and shows the result, the duration, or the error with its stack.
- Keeps an in-memory history you can click to replay a previous call.
- Says so clearly when a tool has no `execute` function, instead of failing.

## What it is not

Not an agent framework, an MCP server, a chat UI, a model playground, or a tracing platform. It runs
tools and shows what came back.

## Installation

```bash
npm install --save-dev ai-tool-inspector
# pnpm add -D ai-tool-inspector
# yarn add -D ai-tool-inspector
```

Node.js 18.17 or newer. The package works offline: no API key, no provider, no account, no database.

## Usage

### Start it from your app

```ts
// src/dev-inspector.ts
import { createToolInspector } from "ai-tool-inspector";
import { tools } from "./tools";

createToolInspector({ tools });
```

Import that file from your development entry point, or run it on its own with `tsx`.

Nothing starts when `NODE_ENV` is `production`, so a stray import cannot expose your tools in a
deployed app. You can be explicit about it as well:

```ts
createToolInspector({
  tools,
  enabled: process.env.NODE_ENV === "development",
});
```

### Control the lifecycle

`createToolInspector` starts listening on its own. It also returns a handle:

```ts
const inspector = createToolInspector({ tools, autoStart: false });

await inspector.start();
console.log(inspector.url); // http://localhost:4984

await inspector.stop();
```

`start()` and `stop()` are both idempotent, so calling either twice is safe.

### Options

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `tools` | `ToolSet` | required | Your AI SDK tools object. |
| `port` | `number` | `4984` | Port to listen on. `0` picks a free one. |
| `host` | `string` | `"localhost"` | Interface to bind. Anything non-loopback prints a warning. |
| `enabled` | `boolean` | `NODE_ENV !== "production"` | When false, nothing starts and every method is a no-op. |
| `autoStart` | `boolean` | `true` | Start listening as soon as the inspector is created. |
| `banner` | `boolean` | `true` | Print the startup banner. |
| `context` | `unknown` | `undefined` | Passed to each tool as `options.context`, for tools with a `contextSchema`. |
| `historyLimit` | `number` | `50` | Executions kept in the history panel. |

### Returned handle

| Member | Type | Meaning |
| --- | --- | --- |
| `url` | `string \| null` | The address the UI is served on, or `null` while not listening. |
| `port` | `number \| null` | The bound port. |
| `enabled` | `boolean` | False when the inspector was disabled through options. |
| `listening` | `boolean` | Whether the server is currently accepting connections. |
| `start()` | `Promise<Inspector>` | Resolves once the server is listening. |
| `stop()` | `Promise<void>` | Resolves once the server is fully shut down. |

### CLI

```bash
npx ai-tool-inspector ./dist/tools.js
npx tsx node_modules/ai-tool-inspector/dist/cli.js ./src/tools.ts --port 5000
```

The CLI imports a module and looks for an exported `tools` object (override with `--export`). It can
only inspect tools it can import on its own, so for tools that live inside a running application, use
the programmatic API.

## Supported AI SDK versions

Built against the AI SDK v5 tool shape and verified against `ai@7`. The inspector reads `inputSchema`,
`description`, `type` and `execute` from each tool, and uses `asSchema` from `@ai-sdk/provider-utils`
to convert the schema. It does not use the pre-v5 `parameters` field.

Schema flavours that work: Zod 3, Zod 4, any Standard Schema implementation, and `jsonSchema()`.
Schemas are only used for JSON Schema generation and input validation, which is exactly what the
model-facing path does.

## Tools without `execute`

Some tools are declared without an `execute` function because the client or the model is expected to
fulfil them:

```ts
askForConfirmation: tool({
  description: "Ask the user to confirm",
  inputSchema: z.object({ question: z.string() }),
  outputSchema: z.object({ confirmed: z.boolean() }),
});
```

The inspector lists these, shows their schema, and explains that they cannot be run. It does not crash,
and the execute endpoint answers `422` rather than throwing. Provider-executed tools are treated the
same way.

## Security

Read this before changing `host`.

> The Tool Inspector executes your application's tools with the same permissions, environment and
> credentials as the host process. Anyone who can reach the port can run any registered tool with any
> arguments. Never expose it to an untrusted network.

Defaults chosen with that in mind:

- Binds to `localhost` only.
- Disabled automatically when `NODE_ENV` is `production`.
- Prints a loud warning when bound to a non-loopback interface such as `0.0.0.0`.
- Serves no authentication, because it is not meant to be reachable by anyone else.
- Exposes only tool names, descriptions and input schemas over the API.

## Architecture

```text
Host application
       │
       │ createToolInspector({ tools })
       ▼
Inspector server  (node:http, no framework)
       │
       ├── GET  /api/info                    name, version, tool count
       ├── GET  /api/tools                   tool metadata
       ├── POST /api/tools/:name/execute     run one tool
       ├── GET  /api/history                 recent executions
       ├── DEL  /api/history                 clear them
       │
       └── static bundle ──► React UI
```

The tools object is read once. For each tool the server derives JSON Schema, a validator, and a set of
starter arguments, then caches them. `POST /api/tools/:name/execute` parses the body, validates it
against the tool schema, calls `execute` directly, drains it if it is an async iterable, and serialises
the result so circular references, `BigInt`, `Map`, `Set`, `Date` and `Error` all survive the trip.

Status codes:

| Situation | Status | Body |
| --- | --- | --- |
| Tool returned a value | `200` | `{ success: true, result, durationMs }` |
| Tool threw | `200` | `{ success: false, error: { kind: "execution", … } }` |
| Body was not JSON, or failed schema validation | `400` | `{ success: false, error: { kind: "input", issues } }` |
| Unknown tool | `404` | `{ success: false, error: { kind: "not-found" } }` |
| Tool has no `execute` | `422` | `{ success: false, error: { kind: "not-executable" } }` |

A tool that throws is a completed request that reports a failure, which is why it is a `200`. A request
the server refused to act on is a `4xx`.

Repository layout:

```text
packages/inspector/
  src/server/      node:http server, routing, static assets
  src/tools/       reads the tools object into cached metadata
  src/schema/      JSON Schema conversion and starter arguments
  src/execution/   validation, execution, serialisation, history
  src/types/       public types
  ui/              React + Vite frontend, built into dist/ui
examples/playground/
```

## Example

The repository ships a playground with tools covering every case: arithmetic, defaults, a slow tool, a
tool that throws, a nested result, and a tool with no `execute`.

```bash
git clone https://github.com/tauheedbuttt/ai-tool-inspector.git
cd ai-tool-inspector
pnpm install
pnpm build
pnpm dev
```

Then open <http://localhost:4984>.

## Development

```bash
pnpm install
pnpm build       # UI bundle, then the library
pnpm typecheck   # run after build, the example imports the built types
pnpm lint
pnpm test
```

Tests boot a real server on an ephemeral port and talk to it over HTTP. They cover tool discovery,
schema conversion, starter-argument generation, execution, malformed JSON, schema violations, tools
that throw, tools without `execute`, history, and the enabled/disabled lifecycle.

## Contributing

Issues and pull requests are welcome. Keep the scope narrow: this is a tool runner, not a platform.
Please run `pnpm lint`, `pnpm build`, `pnpm typecheck` and `pnpm test` before opening a PR.

## License

[MIT](https://github.com/tauheedbuttt/ai-tool-inspector/blob/main/LICENSE)

Not affiliated with or endorsed by Vercel. "AI SDK" refers to the open-source Vercel AI SDK.
