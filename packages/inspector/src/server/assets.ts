import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, normalize, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

let cached: string | null | undefined;

/** Locates the bundled frontend, which sits next to the compiled entry point. */
export async function root(): Promise<string | null> {
  if (cached !== undefined) return cached;

  const here = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [join(here, "ui"), join(here, "..", "dist", "ui"), join(here, "..", "..", "dist", "ui")];

  for (const candidate of candidates) {
    try {
      if ((await stat(join(candidate, "index.html"))).isFile()) {
        cached = candidate;
        return cached;
      }
    } catch {
      // try the next candidate
    }
  }

  cached = null;
  return cached;
}

/** Serves a built asset, falling back to index.html so the UI can own its routes. */
export async function serve(dir: string, pathname: string, res: ServerResponse): Promise<void> {
  const target = within(dir, pathname);
  const file = target && (await isFile(target)) ? target : join(dir, "index.html");

  if (!(await isFile(file))) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const extension = file.slice(file.lastIndexOf("."));
  res.writeHead(200, {
    "content-type": TYPES[extension] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
}

/** Rejects any path that escapes the asset directory. */
function within(dir: string, pathname: string): string | null {
  const decoded = safeDecode(pathname);
  if (decoded === null || decoded.includes("\0")) return null;

  const target = resolvePath(join(dir, normalize(decoded)));
  const base = resolvePath(dir);
  return target === base || target.startsWith(base + sep) ? target : null;
}

function safeDecode(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
