import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert";
import { HttpError } from "./run.ts";
import { openAITranslate } from "./openai.ts";

function openAIResponse(translations: string[], status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: {
        content: JSON.stringify({ translations }),
      },
    }],
  }), { status });
}

Deno.test("OpenAI translation sends protected facts and restores source formatting", async () => {
  const captured: { body?: Record<string, unknown> } = {};
  const result = await openAITranslate(
    ["Plot ₹2,100 with 30 ft road"],
    "ta",
    "test-only-secret",
    async (input, init) => {
      assertEquals(input, "https://api.openai.com/v1/chat/completions");
      assertEquals(new Headers(init?.headers).get("Authorization"), "Bearer test-only-secret");
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      captured.body = body;
      const messages = body.messages as Array<{ content: string }>;
      const submitted = JSON.parse(messages[1].content) as string[];
      assertStringIncludes(submitted[0], "AVXNUMTOKEN0QXZ");
      assertStringIncludes(submitted[0], "AVXNUMTOKEN1QXZ");
      return openAIResponse([
        "மனை ₹AVXNUMTOKEN0QXZ மற்றும் AVXNUMTOKEN1QXZ அடி சாலை",
      ]);
    },
  );
  assertEquals(result, ["மனை ₹2,100 மற்றும் 30 அடி சாலை"]);
  const schema = captured.body?.response_format as Record<string, unknown>;
  assertEquals(schema.type, "json_schema");
});

Deno.test("OpenAI rejects malformed batches and changed numeric placeholders", async () => {
  await assertRejects(
    () => openAITranslate(["one", "two"], "hi", "test", async () => openAIResponse(["एक"])),
    Error,
    "unexpected translation response shape",
  );
  await assertRejects(
    () => openAITranslate(["₹2"], "hi", "test", async () => openAIResponse(["रु"]))
      ,
    Error,
    "protected numeric fact",
  );
});

Deno.test("OpenAI HTTP failures are sanitized and retain retry status", async () => {
  const error = await assertRejects(
    () => openAITranslate(["Plot"], "te", "test-only-secret", async () =>
      new Response("sensitive provider response", { status: 429 })),
    HttpError,
  );
  assertEquals(error.status, 429);
  assertEquals(error.message, "OpenAI Translation HTTP 429");
  assertEquals(error.message.includes("test-only-secret"), false);
});

Deno.test("OpenAI network failures become retryable without exposing request data", async () => {
  const error = await assertRejects(
    () => openAITranslate(["Plot"], "ml", "test-only-secret", async () => {
      throw new Error("network detail");
    }),
    HttpError,
  );
  assertEquals(error.status, 503);
  assertEquals(error.message, "OpenAI request failed or timed out");
});
