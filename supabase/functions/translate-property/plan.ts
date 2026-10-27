// Pure planning/validation logic for translate-property. No network, no database.
export const LANGS = ["ta", "hi", "te", "kn", "ml"] as const;
export const TEXT_FIELDS = [
  "title",
  "short_description",
  "description",
  "location",
  "seo_title",
  "seo_description",
  "seo_keywords",
] as const;
export const FIELDS = [...TEXT_FIELDS, "features"] as const;
export const MAX_REQUEST_STRINGS = 100;
export const MAX_REQUEST_CHARS = 20000;
export const MAX_SINGLE_TEXT = 25000;
export const HARD_MAX_CHARS = 200000;
export const DEFAULT_MAX_CHARS = 50000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Lang = typeof LANGS[number];
export type Request = {
  property_id?: string;
  langs: Lang[];
  dry_run: boolean;
  max_chars: number;
  confirm_characters?: number;
};
export type Existing = {
  property_id: string;
  lang: string;
  field: string;
  source_hash: string;
  status: string;
};
export type Job = {
  id: string;
  field: string;
  source: string;
  hash: string;
  langs: Lang[];
};

export const charCount = (s: string) => Array.from(s).length;

export function protectNumericFacts(text: string): {
  text: string;
  restore: (translated: string) => string;
} {
  const facts: string[] = [];
  const protectedText = text.replace(/\d+(?:,\d{3})*(?:\.\d+)?%?/g, (fact) => {
    const token = `AVXNUMTOKEN${facts.length}QXZ`;
    facts.push(fact);
    return token;
  });
  return {
    text: protectedText,
    restore(translated: string) {
      let restored = translated;
      facts.forEach((fact, index) => {
        const token = `AVXNUMTOKEN${index}QXZ`;
        const parts = restored.split(token);
        if (parts.length !== 2) {
          throw new Error("Translation provider changed a protected numeric fact");
        }
        restored = parts[0] + fact + parts[1];
      });
      return restored;
    },
  };
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function validate(
  body: unknown,
): { ok: true; value: Request } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  const allowed = [
    "property_id",
    "langs",
    "dry_run",
    "max_chars",
    "confirm_characters",
  ];
  for (const k of Object.keys(b)) {
    if (!allowed.includes(k)) {
      return { ok: false, error: `Unknown field: ${k}` };
    }
  }
  if (
    b.property_id !== undefined &&
    (typeof b.property_id !== "string" || !UUID.test(b.property_id))
  ) return { ok: false, error: "property_id must be a UUID" };
  let langs: Lang[] = [...LANGS];
  if (b.langs !== undefined) {
    if (
      !Array.isArray(b.langs) || b.langs.length === 0 ||
      b.langs.length > LANGS.length ||
      !b.langs.every((l) =>
        typeof l === "string" && (LANGS as readonly string[]).includes(l)
      )
    ) {
      return {
        ok: false,
        error: "langs must be a non-empty list of ta, hi, te, kn, ml",
      };
    }
    langs = [...new Set(b.langs as Lang[])];
  }
  if (b.dry_run !== undefined && typeof b.dry_run !== "boolean") {
    return { ok: false, error: "dry_run must be boolean" };
  }
  let max = DEFAULT_MAX_CHARS;
  if (b.max_chars !== undefined) {
    if (
      !Number.isInteger(b.max_chars) || (b.max_chars as number) < 1 ||
      (b.max_chars as number) > HARD_MAX_CHARS
    ) {
      return {
        ok: false,
        error: `max_chars must be an integer 1..${HARD_MAX_CHARS}`,
      };
    }
    max = b.max_chars as number;
  }
  if (
    b.confirm_characters !== undefined &&
    !Number.isInteger(b.confirm_characters)
  ) return { ok: false, error: "confirm_characters must be an integer" };
  return {
    ok: true,
    value: {
      property_id: b.property_id as string | undefined,
      langs,
      dry_run: b.dry_run !== false,
      max_chars: max,
      confirm_characters: b.confirm_characters as number | undefined,
    },
  };
}

export function sourceText(field: string, raw: unknown): string {
  if (field === "features") {
    return Array.isArray(raw)
      ? raw.filter((x) => typeof x === "string").join("\n")
      : "";
  }
  return typeof raw === "string" ? raw : "";
}

// A (property, lang, field) is skipped when a visible OR rejected translation
// already exists for the same English source, so nothing is billed twice.
export async function buildJobs(
  props: Record<string, unknown>[],
  existing: Existing[],
  langs: Lang[],
): Promise<Job[]> {
  const done = new Set(
    existing.filter((r) =>
      ["machine", "approved", "rejected"].includes(r.status)
    )
      .map((r) => `${r.property_id}|${r.lang}|${r.field}|${r.source_hash}`),
  );
  const jobs: Job[] = [];
  for (const p of props) {
    for (const field of FIELDS) {
      const source = sourceText(field, p[field]);
      if (!source.trim()) continue;
      const hash = await sha256(source);
      const need = langs.filter((l) =>
        !done.has(`${p.id}|${l}|${field}|${hash}`)
      );
      if (need.length) {
        jobs.push({ id: p.id as string, field, source, hash, langs: need });
      }
    }
  }
  return jobs;
}

// Features are translated one string each (newlines are not reliably preserved).
export const units = (j: Job): string[] =>
  j.field === "features"
    ? j.source.split("\n").filter((s) => s.trim())
    : [j.source];

export function sourceCharacters(jobs: Job[]): number {
  return jobs.reduce(
    (n, j) =>
      n + units(j).reduce((a, s) => a + charCount(s), 0) * j.langs.length,
    0,
  );
}

export function batches(strings: string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const s of strings) {
    if (charCount(s) > MAX_SINGLE_TEXT) {
      throw new Error("A single text exceeds the per-request limit");
    }
    if (
      cur.length &&
      (cur.length >= MAX_REQUEST_STRINGS ||
        chars + charCount(s) > MAX_REQUEST_CHARS)
    ) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(s);
    chars += charCount(s);
  }
  if (cur.length) out.push(cur);
  return out;
}
