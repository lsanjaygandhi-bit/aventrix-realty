// Admin-only. Translates listing text with OpenAI into ta/hi/te/kn/ml and
// stores results in property_translations with status 'machine' (hidden from
// the public until an admin sets 'approved').
//
// POST { property_id?: uuid, langs?: ("ta"|"hi"|"te"|"kn"|"ml")[], dry_run?: boolean,
//        max_chars?: number, confirm_characters?: number }
//  - dry_run defaults to TRUE: reports source characters and calls nothing external.
//  - A run needs dry_run:false AND confirm_characters equal to the exact source
//    character count reported by a dry run, and must not exceed max_chars.
//    OpenAI billing is token-based; source characters are a workload estimate,
//    not a dollar estimate.
//
// Secrets (supabase secrets set; never in the browser or the repo):
//   OPENAI_API_KEY — existing server-side OpenAI secret.
// Provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  buildJobs,
  type Existing,
  FIELDS,
  type Job,
  type Lang,
  sourceCharacters,
  validate,
} from "./plan.ts";
import { type Row, runTranslation, type Store } from "./run.ts";
import { openAITranslate } from "./openai.ts";

const ALLOWED_ORIGINS = [
  "https://aventrixrealty.com",
  "https://www.aventrixrealty.com",
];

// Best-effort audit trail (see sql/proposal-2026-10-27-translation-runs-NOT-APPLIED.sql).
// A missing table or write error must never fail or hide a completed run.
async function audit(
  db: { from: (t: string) => any },
  entry: Record<string, unknown>,
) {
  try {
    const { error } = await db.from("translation_runs").insert(entry);
    if (error) console.error("audit log failed:", error.message);
  } catch (e) {
    console.error(
      "audit log failed:",
      e instanceof Error ? e.message : "unknown",
    );
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return reply(405, { error: "POST only" });

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return reply(401, { error: "Sign in as an admin" });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData } = await caller.auth.getUser();
  const callerId = userData?.user?.id ?? null;
  const { data: isAdmin, error: adminErr } = await caller.rpc("is_admin");
  if (adminErr || isAdmin !== true) return reply(403, { error: "Admin only" });

  const text = await req.text();
  if (text.length > 4096) return reply(413, { error: "Request too large" });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text || "{}");
  } catch {
    return reply(400, { error: "Invalid JSON" });
  }
  const v = validate(parsed);
  if (!v.ok) return reply(400, { error: v.error });
  const { property_id, langs, dry_run, max_chars, confirm_characters } =
    v.value;

  try {
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let q = db.from("properties").select("id," + FIELDS.join(",")).eq(
      "publish_status",
      "Published",
    );
    if (property_id) q = q.eq("id", property_id);
    const { data: props, error } = await q;
    if (error) throw error;
    const rows = (props ?? []) as unknown as Record<string, unknown>[];
    const ids = rows.map((p) => p.id as string);
    const { data: existing, error: exErr } = ids.length
      ? await db.from("property_translations").select(
        "property_id,lang,field,source_hash,status",
      ).in("property_id", ids).in("lang", langs)
      : { data: [], error: null };
    if (exErr) throw exErr;

    const jobs: Job[] = await buildJobs(
      rows,
      (existing ?? []) as Existing[],
      langs,
    );
    const chars = sourceCharacters(jobs);
    if (dry_run) {
      return reply(200, {
        dry_run: true,
        properties: ids.length,
        jobs: jobs.length,
        source_characters: chars,
      });
    }
    if (chars > max_chars) {
      return reply(413, {
        error: "max_chars exceeded",
        source_characters: chars,
        max_chars,
      });
    }
    if (confirm_characters !== chars) {
      return reply(409, {
        error: "confirm_characters must equal the dry-run source_characters",
        source_characters: chars,
      });
    }

    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) {
      return reply(500, {
        error: "OPENAI_API_KEY is missing from Supabase Edge Function secrets.",
        setup: "Configure the existing OPENAI_API_KEY Supabase Edge Function secret for project gkrtjeygrqkglsadskcg, then deploy the translate-property function.",
      });
    }

    const store: Store = {
      async statuses(keys) {
        const out = new Map<string, string>();
        const ids = [...new Set(keys.map((k) => k.split("|")[0]))];
        const { data, error } = await db.from("property_translations")
          .select("property_id,lang,field,status").in("property_id", ids).in(
            "lang",
            langs,
          );
        if (error) throw error;
        for (const r of data ?? []) {
          out.set(`${r.property_id}|${r.lang}|${r.field}`, r.status);
        }
        return out;
      },
      async insertNew(rows: Row[]) {
        // ignoreDuplicates => ON CONFLICT DO NOTHING: a concurrent run can never overwrite a row.
        const { error } = await db.from("property_translations").upsert(rows, {
          onConflict: "property_id,lang,field",
          ignoreDuplicates: true,
        });
        if (error) throw error;
      },
      async updateUnapproved(row: Row) {
        // Conditional update: matches nothing if the row was approved/rejected meanwhile.
        const { error } = await db.from("property_translations").update({
          value: row.value,
          source_hash: row.source_hash,
          status: "machine",
          provider: row.provider,
        }).eq("property_id", row.property_id).eq("lang", row.lang)
          .eq("field", row.field).in("status", ["machine", "stale"]);
        if (error) throw error;
      },
    };
    const result = await runTranslation(jobs, langs as Lang[], {
      translate: (texts, lang) => openAITranslate(texts, lang, key),
      store,
    });
    await audit(db, {
      requested_by: callerId,
      langs,
      property_id: property_id ?? null,
      source_characters: chars,
      rows_written: result.written,
      rows_skipped_protected: result.skipped_protected,
      status: result.completed ? "completed" : "failed",
      error: result.error ?? null,
    });
    if (!result.completed) {
      return reply(502, {
        error:
          "Translation run stopped before completion; rows already written are kept",
        written: result.written,
        skipped_protected: result.skipped_protected,
        failed_lang: result.failed_lang,
        detail: result.error, // generic message only, never keys or provider bodies
      });
    }
    return reply(200, {
      dry_run: false,
      written: result.written,
      skipped_protected: result.skipped_protected,
      source_characters: chars,
    });
  } catch (e) {
    console.error(
      "translate-property failed:",
      e instanceof Error ? e.message : String(e),
    ); // never log keys
    return reply(500, {
      error: "Translation run failed; see function logs",
      written: 0,
    });
  }
});
