import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Entry, type Info, type Meta, type Outcome } from "./api";
import { Panel, type Restored } from "./panel";
import { format } from "./json";

export function App() {
  const [info, setInfo] = useState<Info | null>(null);
  const [tools, setTools] = useState<Meta[] | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [restored, setRestored] = useState<Restored | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [loadedInfo, loadedTools, loadedHistory] = await Promise.all([
          api.info(),
          api.tools(),
          api.history(),
        ]);
        setInfo(loadedInfo);
        setTools(loadedTools);
        setHistory(loadedHistory);
        setSelected(loadedTools[0]?.name ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
  }, []);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!tools) return [];
    if (!needle) return tools;
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(needle) || (tool.description ?? "").toLowerCase().includes(needle),
    );
  }, [tools, filter]);

  const meta = tools?.find((tool) => tool.name === selected) ?? null;

  const run = useCallback(async (name: string, input: string): Promise<Outcome> => {
    const outcome = await api.execute(name, input);
    setHistory(await api.history());
    return outcome;
  }, []);

  function select(name: string) {
    setSelected(name);
    setRestored(null);
  }

  function replay(entry: Entry) {
    setSelected(entry.tool);
    setRestored({
      input: format(entry.input),
      outcome: entry.success
        ? { success: true, result: entry.result, durationMs: entry.durationMs }
        : { success: false, error: entry.error ?? { kind: "execution", message: "Unknown error" }, durationMs: entry.durationMs },
    });
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>AI SDK Tool Inspector</h1>
        <span className="host">{location.host}</span>
        <span className="spacer" />
        {info ? <span className="version">v{info.version}</span> : null}
      </header>

      <div className="body">
        <aside className="sidebar">
          <div className="section-label">
            <span>Tools</span>
            <span>{tools?.length ?? 0}</span>
          </div>
          <input
            className="filter"
            placeholder="Filter…"
            spellCheck={false}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="tools">
            {tools === null ? <p className="empty">Loading…</p> : null}
            {tools !== null && visible.length === 0 ? <p className="empty">No tools match.</p> : null}
            {visible.map((tool) => (
              <button
                key={tool.name}
                type="button"
                className="tool"
                aria-current={tool.name === selected}
                onClick={() => select(tool.name)}
              >
                <span className={tool.executable ? "dot" : "dot off"} />
                <span className="name">{tool.name}</span>
              </button>
            ))}
          </div>

          <div className="history">
            <div className="section-label">
              <span>History</span>
              {history.length > 0 ? (
                <button
                  type="button"
                  className="link"
                  onClick={() => void api.clearHistory().then(setHistory)}
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="entries">
              {history.length === 0 ? <p className="empty">No executions yet.</p> : null}
              {history.map((entry) => (
                <button key={entry.id} type="button" className="entry" onClick={() => replay(entry)}>
                  <span className={entry.success ? "mark" : "mark bad"}>{entry.success ? "✓" : "✕"}</span>
                  <span className="tool-name">{entry.tool}</span>
                  <span className="time">
                    {entry.durationMs}ms · {clock(entry.at)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="main">
          {error ? <p className="notice">Could not reach the inspector API: {error}</p> : null}
          {!error && meta ? <Panel meta={meta} restored={restored} onRun={run} /> : null}
          {!error && !meta && tools !== null ? (
            <p className="placeholder">
              {tools.length === 0 ? "No tools were registered." : "Select a tool to get started."}
            </p>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function clock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString(undefined, { hour12: false });
}
