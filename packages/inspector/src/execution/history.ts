import type { Entry } from "../types";

/** In-memory ring of past executions. Cleared when the process restarts. */
export class History {
  readonly #limit: number;
  #entries: Entry[] = [];
  #next = 0;

  constructor(limit = 50) {
    this.#limit = Math.max(0, limit);
  }

  /** Returns the stored entry so callers can hand its id back to the client. */
  add(entry: Omit<Entry, "id">): Entry {
    if (this.#limit === 0) return { ...entry, id: "0" };
    const stored: Entry = { ...entry, id: String(++this.#next) };
    this.#entries.unshift(stored);
    if (this.#entries.length > this.#limit) this.#entries.length = this.#limit;
    return stored;
  }

  list(): Entry[] {
    return this.#entries;
  }

  clear(): void {
    this.#entries = [];
  }
}
