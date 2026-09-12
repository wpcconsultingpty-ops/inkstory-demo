import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server";
import {
  MAX_BRIEF_LENGTH, MAX_IMAGE_BYTES, MAX_JSON_BYTES, RequestError, assertSameOrigin,
  conceptImageUrl, decodeRasterBase64, rasterMime, readJsonObject, requireGenerationEnabled,
  resolvePrivateImageSource, validateBrief, validateDirectionIndex, validateUUID
} from "../src/lib/security";
import { generateTattooImage, providerTimeoutForLease } from "../src/lib/openai-image";
import * as security from "../src/lib/security";
import * as generationPlan from "../src/lib/generation-plan";
import { apiFailure } from "../src/lib/pilot-server";
import type { BriefDraft } from "../src/lib/brief";
import { POST as demoGenerate } from "../src/app/api/demo-generate/route";
import { POST as demoGenerateOne } from "../src/app/api/demo-generate-one/route";
import { POST as purchase } from "../src/app/api/purchase/route";
import { POST as prepare } from "../src/app/api/generate/route";
import { POST as generateOne, maxDuration } from "../src/app/api/generate-one/route";

const USER = "11111111-1111-4111-8111-111111111111";
const BRIEF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const URL_BASE = "https://project.supabase.co";
const PNG = "iVBORw0KGgo=";
const lease = () => ({ expiresAt: new Date(Date.now() + 300_000).toISOString() });
const validBrief = {
  meaning: "A tribute to my family", placement: "Forearm", size_cm: "10 cm",
  style: "Fine-line", key_elements: "Olive branch", palette: "Black and grey", reference_notes: ""
};
function status(expected: number) {
  return (error: unknown) => error instanceof RequestError && error.status === expected;
}
function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://inkstory.test/api/generate", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body
  });
}

test("brief validator returns a trimmed copy and enforces every required field", () => {
  assert.equal(validateBrief({ ...validBrief, meaning: ` ${validBrief.meaning} ` }).meaning, validBrief.meaning);
  for (const field of ["meaning", "placement", "size_cm", "style", "key_elements", "palette"]) {
    assert.throws(() => validateBrief({ ...validBrief, [field]: " \n\t" }), status(400));
    assert.throws(() => validateBrief({ ...validBrief, [field]: 123 }), status(400));
  }
  assert.throws(() => validateBrief({ ...validBrief, meaning: "123456789" }), status(400));
  assert.throws(() => validateBrief({ ...validBrief, style: "x".repeat(121) }), status(400));
  assert.throws(() => validateBrief({ ...validBrief, reference_notes: "\u0000" }), status(400));
  assert.equal(validateBrief({ ...validBrief, reference_notes: null }).reference_notes, "");
  assert.throws(() => validateBrief([]), status(400));
});

test("brief combined limit is exactly 6000 and counts Unicode code points", () => {
  assert.equal(MAX_BRIEF_LENGTH, 6000);
  const maximal = { meaning: "m".repeat(2000), key_elements: "k".repeat(2000),
    reference_notes: "r".repeat(1996), placement: "p", size_cm: "s", style: "t", palette: "b" };
  assert.doesNotThrow(() => validateBrief(maximal));
  assert.throws(() => validateBrief({ ...maximal, reference_notes: `${maximal.reference_notes}r` }), status(400));
  assert.equal(Array.from(validateBrief({ ...validBrief, meaning: "🙂".repeat(10) }).meaning).length, 10);
});

test("UUID and index validation reject coercion, fractions, NaN and oversized values", () => {
  assert.equal(validateUUID(BRIEF.toUpperCase()), BRIEF);
  for (const value of ["", "demo-one", "../secret", 1, null, "00000000-0000-0000-0000-000000000000"]) {
    assert.throws(() => validateUUID(value), status(400));
  }
  for (const value of [-1, 3, 0.5, NaN, Infinity, "1", null, true]) {
    assert.throws(() => validateDirectionIndex(value), status(400));
  }
  [0, 1, 2].forEach((value) => assert.equal(validateDirectionIndex(value), value));
  assert.equal(conceptImageUrl(BRIEF), `/api/concept-image/${BRIEF}`);
});

test("JSON reader handles malformed, absent, array and oversized streaming bodies", async () => {
  for (const body of ["{", "", "null", "[]", "true"]) {
    await assert.rejects(readJsonObject(request(body)), status(400));
  }
  await assert.rejects(readJsonObject(request("{}", { "content-type": "text/plain" })), status(400));
  await assert.rejects(readJsonObject(request("{}", { "content-length": String(MAX_JSON_BYTES + 1) })), status(413));
  await assert.rejects(readJsonObject(request(`{"x":"${"x".repeat(MAX_JSON_BYTES)}"}`)), status(413));
  assert.deepEqual(await readJsonObject(request('{"idx":0}')), { idx: 0 });
});

test("origin guard accepts same-origin or absent origin, never forwarding-header claims", () => {
  assert.doesNotThrow(() => assertSameOrigin(request("{}")));
  assert.doesNotThrow(() => assertSameOrigin(request("{}", { origin: "https://inkstory.test" })));
  for (const origin of ["null", "https://attacker.test", "https://inkstory.test.attacker.test"]) {
    assert.throws(() => assertSameOrigin(request("{}", { origin, "x-forwarded-host": "attacker.test" })), status(403));
  }
  assert.throws(() => assertSameOrigin(request("{}", { "sec-fetch-site": "cross-site" })), status(403));
});

test("environment generation gate is explicitly fail closed", () => {
  for (const value of [undefined, "", "false", "TRUE", "1", " true "]) {
    assert.throws(() => requireGenerationEnabled(value), status(503));
  }
  assert.doesNotThrow(() => requireGenerationEnabled("true"));
});

test("private images only resolve exact owner/brief same-bucket raster objects", () => {
  const path = `${USER}/${BRIEF}/direction-1.png`;
  assert.deepEqual(resolvePrivateImageSource(path, USER, BRIEF, URL_BASE), { kind: "object", path });
  for (const access of ["public", "authenticated", "sign"]) {
    assert.deepEqual(resolvePrivateImageSource(
      `${URL_BASE}/storage/v1/object/${access}/concepts/${path}`, USER, BRIEF, URL_BASE
    ), { kind: "object", path });
  }
  for (const value of [
    `https://evil.test/storage/v1/object/public/concepts/${path}`,
    `${URL_BASE}/storage/v1/object/public/other/${path}`,
    `${URL_BASE}/storage/v1/object/public/concepts/${path}/../secret.png`,
    `${USER}/${BRIEF}/%2e%2e%2fsecret.png`,
    `${USER}/${BRIEF}/..\\secret.png`, `${USER}/${BRIEF}/image.svg`,
    `${USER}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/image.png`,
    `22222222-2222-4222-8222-222222222222/${BRIEF}/image.png`,
    "//evil.test/image.png", "file:///etc/passwd", "data:text/html;base64,SGk=",
    "data:image/svg+xml;base64,SGk=", "demo/legacy/direction-1.png"
  ]) {
    assert.throws(() => resolvePrivateImageSource(value, USER, BRIEF, URL_BASE), status(404), value);
  }
});

test("legacy inline images are raster-only, size-limited, with signature checks", () => {
  const png = "iVBORw0KGgo=";
  const source = resolvePrivateImageSource(`data:image/png;base64,${png}`, USER, BRIEF, URL_BASE);
  assert.equal(source.kind, "inline");
  assert.equal(rasterMime(decodeRasterBase64(png, "image/png")), "image/png");
  for (const bad of ["", "not base64", "PHN2Zz48L3N2Zz4=", `${png}=`, "A".repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4)]) {
    assert.throws(() => decodeRasterBase64(bad, "image/png"), status(502));
  }
  assert.throws(() => decodeRasterBase64(png, "image/jpeg"), status(502));
});

test("both demo routes and purchase are unconditional no-cost endpoints", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls += 1; throw new Error("No outbound calls permitted"); });
  for (const handler of [demoGenerate, demoGenerateOne]) {
    const response = await handler();
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /disabled/);
  }
  const response = await purchase();
  assert.equal(response.status, 410);
  assert.match((await response.json()).error, /unavailable/);
  assert.equal(calls, 0);
});

test("authenticated endpoints reject malformed inputs before auth or provider access", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("No outbound calls permitted"); });
  for (const handler of [prepare, generateOne]) {
    assert.equal((await handler(request("{"))).status, 400);
    assert.equal((await handler(request("[]"))).status, 400);
    assert.equal((await handler(request('{"brief_id":"bad"}'))).status, 400);
    assert.equal((await handler(request("{}", { origin: "https://attacker.test" }))).status, 403);
    assert.equal((await handler(request(`{"x":"${"x".repeat(MAX_JSON_BYTES)}"}`))).status, 413);
  }
  assert.equal((await generateOne(request(JSON.stringify({ brief_id: BRIEF, idx: 0.5 })))).status, 400);
});

test("invalid output modes and spend controls fail before authentication, the env gate or reservation", async (t) => {
  const savedGate = process.env.INKSTORY_GENERATION_ENABLED;
  process.env.INKSTORY_GENERATION_ENABLED = "false";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("No outbound calls permitted"); });
  try {
    for (const output_mode of [null, "", false, true, 0, 1, [], {}, "ON_BODY", "on-body", " artwork ", "photo"]) {
      const res = await generateOne(request(JSON.stringify({ brief_id: BRIEF, idx: 0, output_mode })));
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, /output_mode must be on_body or artwork/);
    }
    for (const option of ["model", "quality", "size", "n", "prompt", "brief", "expiresAt", "timeoutMs", "output_format"]) {
      const res = await generateOne(request(JSON.stringify({ brief_id: BRIEF, idx: 0, [option]: "override" })));
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, /Only brief_id, idx and output_mode are accepted/);
    }
    assert.equal(calls, 0);
  } finally {
    if (savedGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = savedGate;
  }
});

test("image provider helper fails explicitly and never retries ambiguous cost", async (t) => {
  const previousGate = process.env.INKSTORY_GENERATION_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  // TEST SENTINEL ONLY: never sent outside the mocked fetch.
  process.env.OPENAI_API_KEY = "offline-test-sentinel";
  process.env.INKSTORY_GENERATION_ENABLED = "true";
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response('{"error":"provider test"}', { status: 429 });
  });
  try {
    await assert.rejects(generateTattooImage("offline test", lease()), status(503));
    assert.equal(calls, 1);
    fetchMock.mock.mockImplementation(async () => { calls += 1; throw new Error("timeout"); });
    await assert.rejects(generateTattooImage("offline test", lease()), status(502));
    assert.equal(calls, 2);
    fetchMock.mock.mockImplementation(async () => { calls += 1; return Response.json({ data: [] }); });
    await assert.rejects(generateTattooImage("offline test", lease()), status(502));
    process.env.INKSTORY_GENERATION_ENABLED = "false";
    await assert.rejects(generateTattooImage("offline test", lease()), status(503));
    assert.equal(calls, 3);
  } finally {
    if (previousGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = previousGate;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("provider timeout is capped at 180s and bounded by the returned lease minus 30s", () => {
  const now = Date.parse("2026-09-12T12:00:00Z");
  assert.equal(maxDuration, 240);
  for (const [seconds, expected] of [[900, 180_000], [300, 180_000], [210, 180_000], [120, 90_000], [75, 45_000]]) {
    assert.equal(providerTimeoutForLease(new Date(now + seconds * 1000).toISOString(), now), expected);
  }
  assert.equal(providerTimeoutForLease("2026-09-12T12:02:00.123456+00:00", now), 90_123);
  for (const value of [
    undefined, null, 300_000, "", "invalid", "2026-09-12", "2026-09-12T12:02:00",
    "2026-99-12T12:02:00Z", new Date(now + 74_999).toISOString(),
    new Date(now).toISOString(), new Date(now - 1000).toISOString()
  ]) {
    assert.throws(() => providerTimeoutForLease(value, now), status(409));
  }
  assert.throws(() => providerTimeoutForLease(new Date(now + 300_000).toISOString(), NaN), status(409));
});

test("provider sends one fixed Flare high portrait PNG regardless of extra runtime options", async (t) => {
  const savedGate = process.env.INKSTORY_GENERATION_ENABLED;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.INKSTORY_GENERATION_ENABLED = "true";
  process.env.OPENAI_API_KEY = "offline-test-sentinel";
  const now = Date.parse("2026-09-12T12:00:00Z");
  t.mock.method(Date, "now", () => now);
  const timeouts: number[] = [];
  t.mock.method(AbortSignal, "timeout", (ms: number) => { timeouts.push(ms); return new AbortController().signal; });
  const payloads: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, { "Content-Type": "application/json", Authorization: "Bearer offline-test-sentinel" });
    assert.ok(init?.signal instanceof AbortSignal);
    payloads.push(JSON.parse(String(init?.body)));
    return Response.json({ data: [{ b64_json: PNG }], size: "1024x1536", quality: "high", output_format: "png" });
  });
  try {
    const options = {
      expiresAt: new Date(now + 120_000).toISOString(),
      model: "not-allowed", quality: "low", size: "1536x1024", n: 5, timeoutMs: 900_000
    };
    const result = await generateTattooImage("an exact compiled prompt", options);
    assert.deepEqual(payloads, [{
      model: "gpt-image-2.5-flare", prompt: "an exact compiled prompt",
      size: "1024x1536", quality: "high", output_format: "png", n: 1
    }]);
    assert.deepEqual(result, { b64: PNG, model: "gpt-image-2.5-flare", size: "1024x1536", quality: "high" });
    assert.deepEqual(timeouts, [90_000]);
    const plan = generationPlan.buildGenerationPlan(validBrief, 0, "on_body");
    assert.equal(result.model, plan.model);
    assert.equal(result.size, plan.size);
    assert.equal(result.quality, plan.quality);
  } finally {
    if (savedGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = savedGate;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  }
});

test("provider accepts only the fixed Flare alias or documented snapshot and records the actual response model", async (t) => {
  const savedGate = process.env.INKSTORY_GENERATION_ENABLED;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.INKSTORY_GENERATION_ENABLED = "true";
  process.env.OPENAI_API_KEY = "offline-test-sentinel";
  let responseModel: unknown;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(JSON.parse(String(init?.body)).model, "gpt-image-2.5-flare");
    return Response.json({ data: [{ b64_json: PNG }], model: responseModel });
  });
  try {
    for (const value of [undefined, "gpt-image-2.5-flare", "gpt-image-2.5-flare-2026-09-08"]) {
      responseModel = value;
      const result = await generateTattooImage("offline exact prompt", lease());
      assert.equal(result.model, value ?? "gpt-image-2.5-flare");
    }
    for (const value of [null, "", 1, {}, "gpt-image-2.5-flare-2026-09-09", "gpt-image-2.5-sunburst", "gpt-image-1"]) {
      responseModel = value;
      const before = calls;
      await assert.rejects(generateTattooImage("offline exact prompt", lease()), status(502));
      assert.equal(calls, before + 1);
    }
    assert.equal(calls, 10);
  } finally {
    if (savedGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = savedGate;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  }
});

test("provider fails closed before fetch for insufficient, absent or malformed reservation expiry", async (t) => {
  const savedGate = process.env.INKSTORY_GENERATION_ENABLED;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.INKSTORY_GENERATION_ENABLED = "true";
  process.env.OPENAI_API_KEY = "offline-test-sentinel";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("No request expected"); });
  try {
    for (const expiresAt of [undefined, null, "invalid", new Date(Date.now() + 20_000).toISOString()]) {
      await assert.rejects(generateTattooImage("offline test", { expiresAt }), status(409));
    }
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(generateTattooImage("offline test", lease()), status(503));
    assert.equal(calls, 0);
  } finally {
    if (savedGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = savedGate;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  }
});

test("provider rejects malformed, non-PNG, multiple, oversized and mismatched responses without retries", async (t) => {
  const savedGate = process.env.INKSTORY_GENERATION_ENABLED;
  const savedKey = process.env.OPENAI_API_KEY;
  process.env.INKSTORY_GENERATION_ENABLED = "true";
  process.env.OPENAI_API_KEY = "offline-test-sentinel";
  let calls = 0;
  let response: () => Response = () => Response.json({});
  t.mock.method(globalThis, "fetch", async () => { calls++; return response(); });
  const oversizedPng = Buffer.concat([Buffer.from(PNG, "base64"), Buffer.alloc(MAX_IMAGE_BYTES - 7)]).toString("base64");
  const failures: Array<[string, () => Response]> = [
    ["provider failure", () => new Response("do not reveal", { status: 500 })],
    ["malformed JSON", () => new Response("{", { headers: { "content-type": "application/json" } })],
    ["HTML response", () => new Response("<html>bad</html>", { headers: { "content-type": "text/html" } })],
    ["null", () => Response.json(null)],
    ["empty result", () => Response.json({ data: [] })],
    ["multiple results", () => Response.json({ data: [{ b64_json: PNG }, { b64_json: PNG }] })],
    ["array-like data", () => Response.json({ data: { 0: { b64_json: PNG } } })],
    ["missing image", () => Response.json({ data: [{}] })],
    ["URL-only result", () => Response.json({ data: [{ url: "https://do-not-fetch.invalid/image.png" }] })],
    ["non-string image", () => Response.json({ data: [{ b64_json: 12 }] })],
    ["invalid base64", () => Response.json({ data: [{ b64_json: "not base64" }] })],
    ["SVG result", () => Response.json({ data: [{ b64_json: Buffer.from("<svg></svg>").toString("base64") }] })],
    ["JPEG result", () => Response.json({ data: [{ b64_json: "/9j/" }] })],
    ["over 8MiB PNG", () => Response.json({ data: [{ b64_json: oversizedPng }] })],
    ["over 12MiB body header", () => new Response("{}", { headers: { "content-type": "application/json", "content-length": String(12 * 1024 * 1024 + 1) } })],
    ["over 12MiB streamed body", () => new Response(" ".repeat(12 * 1024 * 1024 + 1), { headers: { "content-type": "application/json" } })],
    ...Object.entries({ model: "different-model", size: "1024x1024", quality: "low", output_format: "jpeg" }).map(
      ([field, value]): [string, () => Response] => [`mismatched ${field}`, () => Response.json({ data: [{ b64_json: PNG }], [field]: value })]
    )
  ];
  try {
    for (const [label, factory] of failures) {
      response = factory;
      const before = calls;
      await assert.rejects(generateTattooImage("offline test", lease()), status(502), label);
      assert.equal(calls, before + 1, `${label}: exactly one provider attempt`);
    }
  } finally {
    if (savedGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = savedGate;
    if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedKey;
  }
});

// Execute the actual route's TypeScript with narrow offline dependency doubles.
// The production route has no test hooks or injection surface. All request
// validation, orchestration, metadata, lease checks and error handling run here.
function offlineGenerationRoute(options: {
  expiresAt?: unknown;
  failAt?: "auth" | "reserve" | "provider" | "upload" | "complete";
  gate?: string;
  preflightBrief?: BriefDraft;
  snapshotBrief?: BriefDraft;
  overflowAt?: "preflight" | "snapshot";
  responseModel?: string;
} = {}) {
  const calls: string[] = [];
  let providerCalls = 0;
  let metadata: Record<string, unknown> | undefined;
  let prompt = "";
  let validations = 0;
  const reservationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const conceptId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const path = `${USER}/${BRIEF}/${reservationId}.png`;
  const expiresAt = Object.hasOwn(options, "expiresAt") ? options.expiresAt : lease().expiresAt;
  const snapshot = options.snapshotBrief ?? { ...validBrief, meaning: "A durable saved snapshot, not an arbitrary client brief.", key_elements: "A rosemary sprig" };
  const supa = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push(name);
      if (name === "pilot_reserve_generation") {
        assert.deepEqual(params, { p_brief_id: BRIEF, p_idx: 1 });
        if (options.failAt === "reserve") return { data: null, error: { message: "pilot_quota" } };
        return { data: { reservation_id: reservationId, brief: snapshot, expires_at: expiresAt }, error: null };
      }
      assert.equal(params.p_reservation_id, reservationId);
      if (name === "pilot_fail_generation") return { error: null };
      assert.equal(name, "pilot_complete_generation");
      assert.equal(params.p_prompt, prompt);
      assert.ok(Array.from(String(params.p_prompt)).length <= 10_000, "SQL char_length ceiling");
      metadata = params.p_meta as Record<string, unknown>;
      if (options.failAt === "complete") return { data: null, error: { message: "pilot_lease" } };
      return { data: { id: conceptId, image_url: path, thumbnail_url: path, meta: metadata, idx: 1 }, error: null };
    },
    storage: { from: (bucket: string) => {
      assert.equal(bucket, "concepts");
      return { upload: async (object: string, bytes: Uint8Array, settings: Record<string, unknown>) => {
        calls.push("upload");
        assert.equal(object, path);
        assert.equal(rasterMime(bytes), "image/png");
        assert.deepEqual(settings, { contentType: "image/png", upsert: false, cacheControl: "0" });
        return { error: options.failAt === "upload" ? { message: "offline failure" } : null };
      } };
    } }
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/security": security,
    "@/lib/generation-plan": {
      ...generationPlan,
      validateGenerationPrompt: (prompt: unknown) => {
        validations++;
        // Simulate future static policy growth independently of brief limits.
        // Production validation remains the real shared helper in both paths.
        if ((options.overflowAt === "preflight" && validations === 1) ||
            (options.overflowAt === "snapshot" && validations === 2)) {
          return generationPlan.validateGenerationPrompt(`${prompt}${"x".repeat(10_001)}`);
        }
        return generationPlan.validateGenerationPrompt(prompt);
      }
    },
    "@/lib/openai-image": {
      generateTattooImage: async (value: string, opts: { expiresAt: unknown }) => {
        assert.equal(opts.expiresAt, expiresAt);
        providerTimeoutForLease(opts.expiresAt);
        calls.push("provider");
        providerCalls++;
        prompt = value;
        if (options.failAt === "provider") throw new RequestError(502, "Offline provider failure.");
        return { b64: PNG, model: options.responseModel ?? "gpt-image-2.5-flare", size: "1024x1536", quality: "high" };
      }
    },
    "@/lib/pilot-server": {
      apiFailure,
      pilotContext: async () => {
        calls.push("auth");
        if (options.failAt === "auth") throw new RequestError(401, "Sign in to continue.");
        requireGenerationEnabled(options.gate ?? "true");
        return { supa, user: { id: USER } };
      },
      ownedBrief: async () => { calls.push("ownedBrief"); return options.preflightBrief ?? validBrief; },
      rpcError: (error: { message?: string } | null): never => {
        throw new RequestError(error?.message === "pilot_quota" ? 429 : 409, "Offline reservation failure.");
      }
    }
  };
  const source = readFileSync(resolve(import.meta.dirname, "../src/app/api/generate-one/route.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as { POST: (req: Request) => Promise<Response> } };
  const evaluate = new Function("require", "module", "exports", "process", js);
  evaluate((id: string) => {
    assert.ok(Object.hasOwn(dependencies, id), `Unmocked dependency: ${id}`);
    return dependencies[id];
  }, module, module.exports, { env: { OPENAI_API_KEY: "offline-route-sentinel" } });
  return {
    POST: module.exports.POST, calls, path, conceptId, snapshot,
    get providerCalls() { return providerCalls; },
    get metadata() { return metadata; },
    get prompt() { return prompt; },
    get validations() { return validations; }
  };
}

test("route reserves first, uses saved snapshot, returns private image URLs and persists actual metadata", async () => {
  for (const mode of [undefined, "on_body", "artwork"] as const) {
    const route = offlineGenerationRoute();
    const response = await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1, output_mode: mode })));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(route.calls, ["auth", "ownedBrief", "pilot_reserve_generation", "provider", "upload", "pilot_complete_generation"]);
    assert.equal(route.providerCalls, 1);
    assert.equal(route.validations, 2);
    const plan = generationPlan.buildGenerationPlan(route.snapshot, 1, mode ?? "on_body");
    assert.equal(route.prompt, plan.prompt);
    assert.deepEqual(route.metadata, {
      variant: "Balanced composition", detail: plan.description,
      output_mode: mode ?? "on_body", prompt_version: plan.promptVersion,
      model: plan.model, size: plan.size, quality: plan.quality
    });
    const { concept } = await response.json();
    assert.equal(concept.image_url, `/api/concept-image/${route.conceptId}`);
    assert.equal(concept.thumbnail_url, concept.image_url);
    assert.deepEqual(concept.meta, route.metadata);
    assert.notEqual(concept.image_url, route.path);
  }
});

test("prompt overflow preflight returns 400 without reservation or provider spend; snapshot overflow releases without provider access", async () => {
  for (const overflowAt of ["preflight", "snapshot"] as const) {
    const route = offlineGenerationRoute({ overflowAt });
    const response = await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1 })));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /prompt is too long to save.*Shorten the story or notes/);
    assert.equal(route.providerCalls, 0);
    assert.equal(route.metadata, undefined);
    assert.deepEqual(route.calls, overflowAt === "preflight"
      ? ["auth", "ownedBrief"]
      : ["auth", "ownedBrief", "pilot_reserve_generation", "pilot_fail_generation"]);
    assert.equal(route.validations, overflowAt === "preflight" ? 1 : 2);
  }
});

test("maximum-length saved snapshots with quotes, backslashes and Unicode preserve every exclusion and fit before spending", async () => {
  for (const fill of ['"\\', "😀", "漢字"]) {
    const repeated = (count: number) => Array.from(fill.repeat(count)).slice(0, count).join("");
    const input = { ...validBrief, meaning: repeated(2000), key_elements: repeated(2000), reference_notes: "" };
    const used = Object.values(input).reduce((sum, value) => sum + Array.from(value).length, 0);
    const avoidance = "Avoid: Vegvisir, red and lettering. ";
    input.reference_notes = avoidance + repeated(MAX_BRIEF_LENGTH - used - avoidance.length);
    const saved = validateBrief(input);
    assert.equal(Object.values(saved).reduce((sum, value) => sum + Array.from(value).length, 0), 6000);
    for (const output_mode of ["on_body", "artwork"] as const) {
      const route = offlineGenerationRoute({ preflightBrief: saved, snapshotBrief: saved });
      const response = await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1, output_mode })));
      assert.equal(response.status, 200);
      assert.equal(route.validations, 2);
      assert.equal(route.providerCalls, 1);
      assert.equal(route.prompt, generationPlan.buildGenerationPlan(saved, 1, output_mode).prompt);
      assert.ok(route.prompt.includes(saved.reference_notes), "avoidance notes must never be escaped or truncated");
      assert.ok(Array.from(route.prompt).length <= 10_000);
    }
  }
});

test("route persists the accepted provider snapshot model rather than overwriting it with the request alias", async () => {
  const route = offlineGenerationRoute({ responseModel: "gpt-image-2.5-flare-2026-09-08" });
  const response = await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1 })));
  assert.equal(response.status, 200);
  assert.equal(route.metadata?.model, "gpt-image-2.5-flare-2026-09-08");
});

test("route validates modes before auth or reservation even when generation is disabled", async () => {
  for (const output_mode of [null, "", false, 0, "bad", "ARTWORK"]) {
    const route = offlineGenerationRoute({ gate: "false" });
    assert.equal((await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1, output_mode })))).status, 400);
    assert.deepEqual(route.calls, []);
  }
  const disabled = offlineGenerationRoute({ gate: "false" });
  assert.equal((await disabled.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1 })))).status, 503);
  assert.deepEqual(disabled.calls, ["auth"]);
});

test("route releases a too-short or invalid lease without a provider call or concept replacement", async () => {
  for (const expiresAt of [undefined, null, "invalid", new Date(Date.now() + 30_000).toISOString()]) {
    const route = offlineGenerationRoute({ expiresAt });
    const response = await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1 })));
    assert.equal(response.status, 409);
    assert.deepEqual(route.calls, ["auth", "ownedBrief", "pilot_reserve_generation", "pilot_fail_generation"]);
    assert.equal(route.providerCalls, 0);
    assert.equal(route.metadata, undefined);
  }
});

test("route never deletes old artwork or retries and releases only after an existing reservation", async () => {
  for (const [failAt, expectedStatus, expectedCalls] of [
    ["auth", 401, ["auth"]],
    ["reserve", 429, ["auth", "ownedBrief", "pilot_reserve_generation"]],
    ["provider", 502, ["auth", "ownedBrief", "pilot_reserve_generation", "provider", "pilot_fail_generation"]],
    ["upload", 503, ["auth", "ownedBrief", "pilot_reserve_generation", "provider", "upload", "pilot_fail_generation"]],
    ["complete", 409, ["auth", "ownedBrief", "pilot_reserve_generation", "provider", "upload", "pilot_complete_generation", "pilot_fail_generation"]]
  ] as const) {
    const route = offlineGenerationRoute({ failAt });
    const response = await route.POST(request(JSON.stringify({ brief_id: BRIEF, idx: 1 })));
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(route.calls, expectedCalls);
    assert.ok(route.providerCalls <= 1);
  }
});
