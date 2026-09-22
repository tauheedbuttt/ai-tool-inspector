import type { ReactNode } from "react";

const LIMIT = 400_000;
const TOKEN = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;

/** Pretty-prints a value, falling back to String() for anything JSON cannot hold. */
export function format(value: unknown): string {
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Minimal JSON syntax highlighting, no editor dependency. */
export function Json({ value, className }: { value: unknown; className?: string }): ReactNode {
  const text = format(value);
  if (text.length > LIMIT) {
    return (
      <pre className={className}>
        {text.slice(0, LIMIT)}
        {`\n\n… truncated ${(text.length - LIMIT).toLocaleString()} more characters`}
      </pre>
    );
  }
  return <pre className={className}>{highlight(text)}</pre>;
}

function highlight(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    const start = match.index;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <span key={start} className={classOf(match)}>
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function classOf(match: RegExpMatchArray): string {
  if (match[1]) return "j-key";
  if (match[2]) return "j-str";
  if (match[3]) return "j-num";
  if (match[4]) return "j-bool";
  return "j-null";
}
