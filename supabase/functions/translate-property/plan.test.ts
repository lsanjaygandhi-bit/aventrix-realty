import {
  batches,
  buildJobs,
  charCount,
  MAX_REQUEST_CHARS,
  protectNumericFacts,
  sha256,
  sourceCharacters,
  units,
  validate,
} from "./plan.ts";
const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  }
};
Deno.test("validate", () => {
  eq(validate({}).ok, true, "empty ok");
  eq((validate({}) as any).value.dry_run, true, "dry_run default true");
  for (
    const bad of [
      null,
      [],
      { x: 1 },
      { property_id: "abc" },
      { langs: [] },
      { langs: ["fr"] },
      { langs: "ta" },
      { dry_run: "no" },
      { max_chars: 0 },
      { max_chars: 1e9 },
      { max_chars: 1.5 },
      { confirm_characters: "1" },
    ]
  ) {
    eq(validate(bad).ok, false, "reject " + JSON.stringify(bad));
  }
  eq((validate({ langs: ["ta", "ta"] }) as any).value.langs, ["ta"], "dedupe");
});
Deno.test("hash matches SQL sha256 of UTF-8", async () => {
  eq(
    await sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    "sha256 abc",
  );
});
Deno.test("numeric facts are restored exactly and missing placeholders fail", () => {
  const protectedText = protectNumericFacts("₹2,100 at 30 ft, 1.25% return");
  if (!protectedText.text.includes("AVXNUMTOKEN0QXZ") ||
    !protectedText.text.includes("AVXNUMTOKEN2QXZ")) {
    throw new Error("numbers were not protected");
  }
  eq(
    protectedText.restore(protectedText.text.replace(" at ", " near ")),
    "₹2,100 near 30 ft, 1.25% return",
    "source numeric formatting restored",
  );
  let threw = false;
  try {
    protectedText.restore("translated without placeholders");
  } catch {
    threw = true;
  }
  eq(threw, true, "missing numeric placeholder rejected");
});
Deno.test("jobs: skip empty, skip cached/rejected, bill stale, count code points", async () => {
  const p = [{
    id: "p1",
    title: "Plot ₹1",
    short_description: "  ",
    description: null,
    location: "Tambaram",
    features: ["A", "B"],
    seo_title: null,
    seo_description: null,
    seo_keywords: "land plot",
  }];
  const h = await sha256("Plot ₹1");
  let jobs = await buildJobs(p, [], ["ta"]);
  eq(
    jobs.map((j) => j.field),
    ["title", "location", "seo_keywords", "features"],
    "fields with text only",
  );
  eq(
    sourceCharacters(jobs),
    7 + 8 + 2 + 9,
    "chars (features billed per string, no newline)",
  );
  jobs = await buildJobs(p, [{
    property_id: "p1",
    lang: "ta",
    field: "title",
    source_hash: h,
    status: "approved",
  }], ["ta"]);
  eq(jobs.some((j) => j.field === "title"), false, "approved skipped");
  jobs = await buildJobs(p, [{
    property_id: "p1",
    lang: "ta",
    field: "title",
    source_hash: h,
    status: "rejected",
  }], ["ta"]);
  eq(
    jobs.some((j) => j.field === "title"),
    false,
    "rejected same source not re-billed",
  );
  jobs = await buildJobs(p, [{
    property_id: "p1",
    lang: "ta",
    field: "title",
    source_hash: "old",
    status: "stale",
  }], ["ta"]);
  eq(jobs.some((j) => j.field === "title"), true, "stale rebilled");
  eq(charCount("₹😀"), 2, "code points");
  eq(
    units(jobs.find((j) => j.field === "features")!),
    ["A", "B"],
    "feature units",
  );
});
Deno.test("batches respect limits", () => {
  const s = Array.from({ length: 250 }, () => "x".repeat(300));
  const b = batches(s);
  eq(b.flat().length, 250, "all kept");
  for (const x of b) {
    if (x.length > 100 || x.join("").length > MAX_REQUEST_CHARS) {
      throw new Error("batch too big");
    }
  }
  let threw = false;
  try {
    batches(["x".repeat(30000)]);
  } catch {
    threw = true;
  }
  eq(threw, true, "oversize single text rejected");
});
