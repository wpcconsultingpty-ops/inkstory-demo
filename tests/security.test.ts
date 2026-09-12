import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_BRIEF_LENGTH, MAX_IMAGE_BYTES, MAX_JSON_BYTES, RequestError, assertSameOrigin,
  conceptImageUrl, decodeRasterBase64, rasterMime, readJsonObject, requireGenerationEnabled,
  resolvePrivateImageSource, validateBrief, validateDirectionIndex, validateUUID
} from "../src/lib/security";
import { generateTattooImage } from "../src/lib/openai-image";
import { POST as demoGenerate } from "../src/app/api/demo-generate/route";
import { POST as demoGenerateOne } from "../src/app/api/demo-generate-one/route";
import { POST as purchase } from "../src/app/api/purchase/route";
import { POST as prepare } from "../src/app/api/generate/route";
import { POST as generateOne } from "../src/app/api/generate-one/route";

const USER = "11111111-1111-4111-8111-111111111111";
const BRIEF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const URL_BASE = "https://project.supabase.co";
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
    await assert.rejects(generateTattooImage("offline test"), status(503));
    assert.equal(calls, 1);
    fetchMock.mock.mockImplementation(async () => { calls += 1; throw new Error("timeout"); });
    await assert.rejects(generateTattooImage("offline test"), status(502));
    assert.equal(calls, 2);
    fetchMock.mock.mockImplementation(async () => { calls += 1; return Response.json({ data: [] }); });
    await assert.rejects(generateTattooImage("offline test"), status(502));
    process.env.INKSTORY_GENERATION_ENABLED = "false";
    await assert.rejects(generateTattooImage("offline test"), status(503));
    assert.equal(calls, 3);
  } finally {
    if (previousGate === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = previousGate;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
