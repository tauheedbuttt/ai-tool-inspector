import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, Outcome } from "./api";
import type { RefObject } from "react";
import { Json, format } from "./json";

export interface Restored {
  input: string;
  outcome: Outcome | null;
}

interface Props {
  meta: Meta;
  restored: Restored | null;
  onRun: (name: string, input: string) => Promise<Outcome>;
}

/** Detail view for one tool: schema, argument editor, execution result. */
export function Panel({ meta, restored, onRun }: Props) {
  const [input, setInput] = useState(() => format(meta.defaultInput));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [running, setRunning] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInput(restored?.input ?? format(meta.defaultInput));
    setOutcome(restored?.outcome ?? null);
    setRunning(false);
  }, [meta.name, restored]);

  const parseError = useMemo(() => check(input), [input]);
  const blocked = !meta.executable || running || parseError !== null;

  async function execute() {
    if (blocked) return;
    setRunning(true);
    try {
      setOutcome(await onRun(meta.name, input));
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } catch (error) {
      setOutcome({
        success: false,
        durationMs: 0,
        error: { kind: "execution", message: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="detail">
      <header>
        <h2>{meta.name}</h2>
        {meta.description ? <p>{meta.description}</p> : null}
        <div className="badges">
          <span className="badge">{meta.kind}</span>
          {meta.executable ? null : (
            <span className="badge warn">
              {meta.reason === "provider-executed" ? "provider executed" : "no execute"}
            </span>
          )}
          {meta.schemaError ? <span className="badge warn">schema unavailable</span> : null}
        </div>
      </header>

      {meta.executable ? null : (
        <div className="field">
          <p className="notice">
            {meta.reason === "provider-executed"
              ? "This tool is executed by the model provider, so the inspector cannot run it locally."
              : "This tool does not define an execute function and cannot be executed directly."}
          </p>
        </div>
      )}

      {meta.inputSchema ? (
        <div className="field">
          <details className="schema">
            <summary>Input schema</summary>
            <Json className="output" value={meta.inputSchema} />
          </details>
        </div>
      ) : (
        <div className="field">
          <p className="notice">
            Input schema could not be read{meta.schemaError ? `: ${meta.schemaError}` : "."}
          </p>
        </div>
      )}

      <div className="field">
        <div className="field-head">
          <h3>Arguments</h3>
          <div className="actions">
            <button
              type="button"
              className="link"
              disabled={parseError !== null}
              onClick={() => setInput(format(JSON.parse(input || "{}")))}
            >
              Format
            </button>
            <button type="button" className="link" onClick={() => setInput(format(meta.defaultInput))}>
              Reset
            </button>
          </div>
        </div>

        <textarea
          className={parseError ? "editor invalid" : "editor"}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={!meta.executable}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void execute();
            }
          }}
        />

        {parseError ? <p className="hint">Invalid JSON: {parseError}</p> : null}

        <div className="run">
          <button type="button" className="primary" disabled={blocked} onClick={() => void execute()}>
            {running ? "Running…" : "Execute Tool"}
          </button>
          <span className="shortcut">⌘/Ctrl + Enter</span>
        </div>
      </div>

      {outcome ? <Result outcome={outcome} anchor={resultRef} /> : null}
    </section>
  );
}

function Result({ outcome, anchor }: { outcome: Outcome; anchor: RefObject<HTMLDivElement | null> }) {
  return (
    <div className="field" ref={anchor}>
      <div className="field-head">
        <h3>Result</h3>
      </div>

      {outcome.success ? (
        <>
          <p className="status">✓ Completed in {outcome.durationMs}ms</p>
          <Json className="output" value={outcome.result} />
        </>
      ) : (
        <>
          <p className="status bad">✕ {headline(outcome.error.kind)}</p>
          <pre className="output bad">
            {outcome.error.name ? `${outcome.error.name}: ` : ""}
            {outcome.error.message}
            {outcome.error.stack ? `\n\n${outcome.error.stack}` : ""}
          </pre>
          {outcome.error.issues?.length ? (
            <ul className="issues">
              {outcome.error.issues.map((issue, index) => (
                <li key={`${issue.path}-${index}`}>
                  <code>{issue.path}</code> — {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function headline(kind: string): string {
  switch (kind) {
    case "input":
      return "Invalid input";
    case "not-found":
      return "Tool not found";
    case "not-executable":
      return "Tool cannot be executed";
    default:
      return "Tool execution failed";
  }
}

function check(text: string): string | null {
  if (text.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "arguments must be a JSON object";
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
