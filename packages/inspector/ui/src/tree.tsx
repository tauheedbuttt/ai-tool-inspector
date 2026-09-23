import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Json } from "./json";

type Mode = "tree" | "json";

/** Value viewer with a tree table and a raw JSON switch. */
export function Viewer({ label, value, bad }: { label: string; value: unknown; bad?: boolean }) {
  const [mode, setMode] = useState<Mode>("tree");

  return (
    <div className="viewer">
      <div className="viewer-head">
        <h3>{label}</h3>
        <div className="switch" role="group" aria-label={`${label} view`}>
          <button type="button" aria-pressed={mode === "tree"} onClick={() => setMode("tree")}>
            Tree
          </button>
          <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>
            JSON
          </button>
        </div>
      </div>
      {mode === "tree" ? (
        <Tree value={value} bad={bad} />
      ) : (
        <Json className={bad ? "output bad" : "output"} value={value} />
      )}
    </div>
  );
}

/** Path/value table, nested keys collapsed by default. */
export function Tree({ value, bad }: { value: unknown; bad?: boolean }) {
  const rows = entries(value);

  return (
    <div className={bad ? "tree bad" : "tree"}>
      <div className="tree-head">
        <span>Path</span>
        <span>Value</span>
      </div>
      {rows === null ? (
        <Row label="value" value={value} depth={0} />
      ) : rows.length === 0 ? (
        <p className="tree-empty">{Array.isArray(value) ? "Empty array" : "Empty object"}</p>
      ) : (
        rows.map(([key, child]) => <Row key={key} label={key} value={child} depth={0} />)
      )}
    </div>
  );
}

function Row({ label, value, depth }: { label: string; value: unknown; depth: number }) {
  const children = entries(value);
  const [open, setOpen] = useState(false);
  const branch = children !== null && children.length > 0;
  const pad = { paddingLeft: `${12 + depth * 16}px` };

  return (
    <>
      <div className="tree-row">
        {branch ? (
          <button type="button" className="tree-key branch" style={pad} onClick={() => setOpen(!open)}>
            <span className={open ? "caret open" : "caret"}>›</span>
            <span className="label">{label}</span>
            <span className="count">{summary(value, children.length)}</span>
          </button>
        ) : (
          <span className="tree-key" style={pad}>
            <span className="label">{label}</span>
          </span>
        )}
        <span className={branch ? "tree-value" : `tree-value ${tone(value)}`}>
          {branch ? null : <Clamp lines={2}>{leaf(value)}</Clamp>}
        </span>
      </div>
      {branch && open
        ? children.map(([key, child]) => (
            <Row key={key} label={key} value={child} depth={depth + 1} />
          ))
        : null}
    </>
  );
}

/** Clamps content to `lines`, revealing a toggle only when it actually overflows. */
export function Clamp({ lines, children }: { lines: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const check = () => setLong(node.scrollHeight - node.clientHeight > 1);
    if (!open) check();
    const observer = new ResizeObserver(check);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children, open]);

  return (
    <span className="clamp">
      <span ref={box} className={open ? "clamp-body" : "clamp-body cut"} style={{ "--lines": lines } as never}>
        {children}
      </span>
      {long || open ? (
        <button type="button" className="link more" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </span>
  );
}

function entries(value: unknown): [string, unknown][] | null {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item]);
  if (value !== null && typeof value === "object") return Object.entries(value as Record<string, unknown>);
  return null;
}

function summary(value: unknown, count: number): string {
  return Array.isArray(value) ? `[${count}]` : `{${count}}`;
}

function tone(value: unknown): string {
  if (typeof value === "string") return "j-str";
  if (typeof value === "number") return "j-num";
  if (typeof value === "boolean") return "j-bool";
  if (value === null || value === undefined) return "j-null";
  return "";
}

function leaf(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (Array.isArray(value)) return "[]";
  if (value !== null && typeof value === "object") return "{}";
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
