// Billable-run orchestration with injected dependencies, so partial failure,
// retries and approved-row protection can be unit tested without a provider or a database.
import { batches, type Job, type Lang, units } from "./plan.ts";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Row = {
  property_id: string;
  lang: Lang;
  field: string;
  source_hash: string;
  status: "machine";
  provider: string;
  value: string | string[];
};

export type Store = {
  // Current status of existing rows for these keys (key = id|lang|field).
  statuses(keys: string[]): Promise<Map<string, string>>;
  // Insert only rows that do not exist yet; must never overwrite (ON CONFLICT DO NOTHING).
  insertNew(rows: Row[]): Promise<void>;
  // Update one existing row only while its status is still machine or stale.
  // Must be a conditional write (WHERE status IN ('machine','stale')).
  updateUnapproved(row: Row): Promise<void>;
};

export type RunDeps = {
  translate: (texts: string[], lang: Lang) => Promise<string[]>;
  store: Store;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
};

export type RunResult = {
  written: number;
  skipped_protected: number;
  completed: boolean;
  failed_lang?: Lang;
  error?: string;
};

export const rowKey = (id: string, lang: string, field: string) =>
  `${id}|${lang}|${field}`;

// A response is only usable if it holds exactly one non-empty string per input.
export function checkTranslations(texts: string[], out: unknown): string[] {
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new Error("Translation response size mismatch");
  }
  out.forEach((s, i) => {
    if (typeof s !== "string" || (texts[i].trim() && !s.trim())) {
      throw new Error("Translation response contained an invalid item");
    }
  });
  return out as string[];
}

const transient = (e: unknown) =>
  e instanceof HttpError && (e.status === 429 || e.status >= 500);

async function withRetry<T>(fn: () => Promise<T>, deps: RunDeps): Promise<T> {
  const max = deps.maxAttempts ?? 3;
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 1;; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= max || !transient(e)) throw e;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}

// Writes rows without ever overwriting an approved, rejected or already-current row.
export async function writeProtected(
  rows: Row[],
  store: Store,
): Promise<{ written: number; skipped: number }> {
  if (!rows.length) return { written: 0, skipped: 0 };
  const current = await store.statuses(
    rows.map((r) => rowKey(r.property_id, r.lang, r.field)),
  );
  const fresh: Row[] = [];
  const replace: Row[] = [];
  let skipped = 0;
  for (const r of rows) {
    const st = current.get(rowKey(r.property_id, r.lang, r.field));
    if (st === undefined) fresh.push(r);
    else if (st === "stale" || st === "machine") replace.push(r);
    else skipped++; // approved or rejected: a human decision, never overwritten
  }
  if (fresh.length) await store.insertNew(fresh);
  for (const r of replace) await store.updateUnapproved(r);
  return { written: fresh.length + replace.length, skipped };
}

export async function runTranslation(
  jobs: Job[],
  langs: Lang[],
  deps: RunDeps,
): Promise<RunResult> {
  const result: RunResult = {
    written: 0,
    skipped_protected: 0,
    completed: false,
  };
  for (const lang of langs) {
    const todo = jobs.filter((j) => j.langs.includes(lang));
    const flat = todo.flatMap((j) => units(j).map((s) => ({ j, s })));
    const pending = new Map<Job, string[]>();
    const need = new Map<Job, number>();
    todo.forEach((j) => need.set(j, units(j).length));
    let offset = 0;
    try {
      for (const batch of batches(flat.map((x) => x.s))) {
        const out = checkTranslations(
          batch,
          await withRetry(() => deps.translate(batch, lang), deps),
        );
        const ready: Row[] = [];
        out.forEach((t, i) => {
          const { j } = flat[offset + i];
          const acc = [...(pending.get(j) ?? []), t];
          pending.set(j, acc);
          if (acc.length === need.get(j)) {
            ready.push({
              property_id: j.id,
              lang,
              field: j.field,
              source_hash: j.hash,
              status: "machine",
              provider: "openai:gpt-4.1-mini",
              value: j.field === "features" ? acc : acc[0],
            });
          }
        });
        offset += batch.length;
        const w = await withRetry(
          () => writeProtected(ready, deps.store),
          deps,
        );
        result.written += w.written;
        result.skipped_protected += w.skipped;
      }
    } catch (e) {
      result.failed_lang = lang;
      result.error = e instanceof Error ? e.message : "Unknown error";
      return result;
    }
  }
  result.completed = true;
  return result;
}
