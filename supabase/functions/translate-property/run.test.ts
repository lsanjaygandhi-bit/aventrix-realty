import {
  checkTranslations,
  HttpError,
  type Row,
  runTranslation,
  type Store,
  writeProtected,
} from "./run.ts";
import { type Job, MAX_REQUEST_STRINGS } from "./plan.ts";

const assert = (c: boolean, m: string) => {
  if (!c) throw new Error(m);
};
const job = (id: string, field: string, source: string): Job => ({
  id,
  field,
  source,
  hash: "h-" + id + field,
  langs: ["ta"],
});

function memStore(initial: Record<string, string> = {}) {
  const rows = new Map<string, { status: string; value: unknown }>();
  for (const [k, st] of Object.entries(initial)) {
    rows.set(k, { status: st, value: "HUMAN" });
  }
  let failWrites = false;
  const store: Store = {
    statuses: (keys) =>
      Promise.resolve(
        new Map(
          keys.filter((k) => rows.has(k)).map((k) => [k, rows.get(k)!.status]),
        ),
      ),
    insertNew: (rs: Row[]) => {
      if (failWrites) return Promise.reject(new Error("db down"));
      for (const r of rs) {
        const k = `${r.property_id}|${r.lang}|${r.field}`;
        if (!rows.has(k)) rows.set(k, { status: r.status, value: r.value });
      }
      return Promise.resolve();
    },
    updateUnapproved: (r: Row) => {
      const k = `${r.property_id}|${r.lang}|${r.field}`;
      const cur = rows.get(k);
      if (cur && (cur.status === "machine" || cur.status === "stale")) {
        rows.set(k, { status: "machine", value: r.value });
      }
      return Promise.resolve();
    },
  };
  return { store, rows, setFail: (v: boolean) => (failWrites = v) };
}

Deno.test("checkTranslations rejects wrong size and bad items", () => {
  assert(checkTranslations(["a", "b"], ["x", "y"]).length === 2, "ok");
  for (const bad of [["x"], ["x", "y", "z"], null, "x", ["x", 5], ["x", " "]]) {
    let threw = false;
    try {
      checkTranslations(["a", "b"], bad);
    } catch {
      threw = true;
    }
    assert(threw, "should reject " + JSON.stringify(bad));
  }
});

Deno.test("each batch is written immediately; features need all items", async () => {
  const { store, rows } = memStore();
  const jobs = [
    job("p1", "title", "Plot"),
    job("p1", "features", "A\nB\nC"),
  ];
  const calls: string[][] = [];
  const r = await runTranslation(jobs, ["ta"], {
    translate: (t) => {
      calls.push(t);
      return Promise.resolve(t.map((s) => "T:" + s));
    },
    store,
  });
  assert(r.completed && r.written === 2, "written 2: " + JSON.stringify(r));
  assert(
    JSON.stringify(rows.get("p1|ta|features")!.value) ===
      JSON.stringify(["T:A", "T:B", "T:C"]),
    "features array",
  );
  assert(rows.get("p1|ta|title")!.status === "machine", "machine status");
});

Deno.test("partial failure keeps earlier batches, reports count, no row for failed batch", async () => {
  const { store, rows } = memStore();
  // 150 one-string jobs => 2 batches (100 + 50)
  const jobs = Array.from(
    { length: MAX_REQUEST_STRINGS + 50 },
    (_, i) => job("p" + i, "title", "t" + i),
  );
  let n = 0;
  const r = await runTranslation(jobs, ["ta"], {
    translate: (t) =>
      ++n === 2
        ? Promise.reject(new HttpError(400, "bad"))
        : Promise.resolve(t.map((s) => "T:" + s)),
    store,
  });
  assert(!r.completed && r.failed_lang === "ta", "failed");
  assert(
    r.written === MAX_REQUEST_STRINGS,
    "first batch written: " + r.written,
  );
  assert(rows.size === MAX_REQUEST_STRINGS, "no rows for failed batch");
  assert(!JSON.stringify(r).includes("KEY"), "no secrets");
});

Deno.test("size-mismatched response writes nothing for that batch", async () => {
  const { store, rows } = memStore();
  const r = await runTranslation(
    [job("p1", "title", "x"), job("p2", "title", "y")],
    ["ta"],
    {
      translate: () => Promise.resolve(["only one"]),
      store,
    },
  );
  assert(!r.completed && r.written === 0 && rows.size === 0, "nothing written");
});

Deno.test("transient errors are retried with backoff; permanent ones are not", async () => {
  const { store } = memStore();
  let calls = 0;
  const sleeps: number[] = [];
  const ok = await runTranslation([job("p1", "title", "x")], ["ta"], {
    translate: (t) =>
      ++calls < 3
        ? Promise.reject(new HttpError(503, "x"))
        : Promise.resolve(t.map((s) => "T" + s)),
    store,
    sleep: (ms) => (sleeps.push(ms), Promise.resolve()),
  });
  assert(ok.completed && calls === 3, "succeeded after 2 retries");
  assert(JSON.stringify(sleeps) === "[500,1000]", "backoff " + sleeps);

  calls = 0;
  const bad = await runTranslation([job("p2", "title", "x")], ["ta"], {
    translate: () => (calls++, Promise.reject(new HttpError(403, "x"))),
    store,
    sleep: () => Promise.resolve(),
  });
  assert(!bad.completed && calls === 1, "403 not retried");

  calls = 0;
  const giveUp = await runTranslation([job("p3", "title", "x")], ["ta"], {
    translate: () => (calls++, Promise.reject(new HttpError(429, "x"))),
    store,
    sleep: () => Promise.resolve(),
  });
  assert(!giveUp.completed && calls === 3, "max 3 attempts");
});

Deno.test("approved and rejected rows are never overwritten; stale/machine are replaced", async () => {
  const { store, rows } = memStore({
    "p1|ta|title": "approved",
    "p2|ta|title": "rejected",
    "p3|ta|title": "stale",
    "p4|ta|title": "machine",
  });
  const jobs = ["p1", "p2", "p3", "p4", "p5"].map((p) => job(p, "title", "x"));
  const r = await runTranslation(jobs, ["ta"], {
    translate: (t) => Promise.resolve(t.map(() => "NEW")),
    store,
  });
  assert(
    r.completed && r.written === 3 && r.skipped_protected === 2,
    JSON.stringify(r),
  );
  assert(rows.get("p1|ta|title")!.value === "HUMAN", "approved kept");
  assert(rows.get("p2|ta|title")!.value === "HUMAN", "rejected kept");
  assert(rows.get("p3|ta|title")!.value === "NEW", "stale replaced");
  assert(
    rows.get("p5|ta|title")!.status === "machine",
    "new is machine, never approved",
  );
});

Deno.test("row approved between read and write is not overwritten (conditional update)", async () => {
  const { store, rows } = memStore({ "p1|ta|title": "machine" });
  const racing: Store = {
    ...store,
    statuses: async (k) => {
      const m = await store.statuses(k);
      rows.set("p1|ta|title", { status: "approved", value: "HUMAN" }); // admin approves mid-run
      return m;
    },
  };
  await writeProtected(
    [{
      property_id: "p1",
      lang: "ta",
      field: "title",
      source_hash: "h",
      status: "machine",
      provider: "g",
      value: "NEW",
    }],
    racing,
  );
  assert(
    rows.get("p1|ta|title")!.value === "HUMAN",
    "approved survived the race",
  );
});

Deno.test("database failure stops the run and is reported", async () => {
  const { store, setFail } = memStore();
  setFail(true);
  const r = await runTranslation([job("p1", "title", "x")], ["ta"], {
    translate: (t) => Promise.resolve(t),
    store,
  });
  assert(
    !r.completed && r.written === 0 && r.error === "db down",
    JSON.stringify(r),
  );
});
