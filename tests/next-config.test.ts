import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const STAGING_REF = "ekeewaqospfceracerkl";
const PRODUCTION_REF = "yawmspiblfzzsosyeboc";
const VERCEL_PROJECT_ID = "prj_KZL8MikMxfpdq9SiiMquOWt6Y2y9";
const enabled = {
  INKSTORY_GENERATION_ENABLED: "true",
  INKSTORY_CONTROLLED_STAGING_TEST: "true"
};

// Load the real config in a fresh process, without module caching or .env loading.
// Explicitly clear optional guard inputs so the caller's environment cannot opt in.
function loadNextConfig(overrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env };
  const inputs: Record<string, string | undefined> = {
    NEXT_PUBLIC_INKSTORY_ENVIRONMENT: "staging",
    NEXT_PUBLIC_INKSTORY_STAGING_REF: STAGING_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    INKSTORY_GENERATION_ENABLED: "false",
    INKSTORY_CONTROLLED_STAGING_TEST: undefined,
    VERCEL_PROJECT_ID: undefined,
    ...overrides
  };
  for (const [key, value] of Object.entries(inputs)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const result = spawnSync(process.execPath, ["-e", `
    const config = require(${JSON.stringify(resolve("next.config.js"))});
    config.headers().then((headers) => console.log(JSON.stringify({
      reactStrictMode: config.reactStrictMode,
      poweredByHeader: config.poweredByHeader,
      images: config.images,
      headers
    }))).catch((error) => { console.error(error); process.exitCode = 1; });
  `], { env, encoding: "utf8", timeout: 10_000 });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function assertAllowed(overrides: Record<string, string | undefined> = {}) {
  const result = loadNextConfig(overrides);
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.reactStrictMode, true);
  assert.equal(config.poweredByHeader, false);
  assert.deepEqual(config.images, { unoptimized: true, remotePatterns: [] });
  assert.deepEqual(config.headers, [{
    source: "/:path*",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
    ]
  }]);
}

function assertRejected(overrides: Record<string, string | undefined>) {
  const result = loadNextConfig(overrides);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Staging must use an isolated database and disabled generation/);
}

test("next config accepts valid disabled staging without the override", () => {
  assertAllowed();
});

test("next config preserves disabled staging for other isolated refs and optional flag values", () => {
  for (const override of [undefined, "", "false", "true", "TRUE", " true "]) {
    assertAllowed({
      NEXT_PUBLIC_INKSTORY_STAGING_REF: "isolated-test",
      NEXT_PUBLIC_SUPABASE_URL: "https://isolated-test.supabase.co",
      INKSTORY_CONTROLLED_STAGING_TEST: override,
      VERCEL_PROJECT_ID: "another-project"
    });
  }
});

test("next config rejects enabled staging without the controlled override", () => {
  assertRejected({ INKSTORY_GENERATION_ENABLED: "true" });
  assertRejected({ ...enabled, INKSTORY_CONTROLLED_STAGING_TEST: "false" });
});

test("next config accepts controlled generation only for the approved staging projects", () => {
  assertAllowed(enabled);
  assertAllowed({ ...enabled, VERCEL_PROJECT_ID });
});

test("next config rejects production database refs even with the controlled override", () => {
  for (const flags of [{}, enabled]) {
    assertRejected({
      ...flags,
      NEXT_PUBLIC_INKSTORY_STAGING_REF: PRODUCTION_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`
    });
  }
});

test("next config rejects missing refs even with the controlled override", () => {
  for (const flags of [{}, enabled]) {
    for (const ref of [undefined, ""]) {
      assertRejected({
        ...flags,
        NEXT_PUBLIC_INKSTORY_STAGING_REF: ref,
        NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`
      });
    }
  }
});

test("next config rejects mismatched or missing URLs even with the controlled override", () => {
  for (const flags of [{}, enabled]) {
    for (const url of [
      undefined, "", `https://${PRODUCTION_REF}.supabase.co`,
      "https://isolated-test.supabase.co", `https://${STAGING_REF}.supabase.co/`,
      `http://${STAGING_REF}.supabase.co`, `https://${STAGING_REF}.supabase.co.evil.test`
    ]) {
      assertRejected({ ...flags, NEXT_PUBLIC_SUPABASE_URL: url });
    }
  }
});

test("next config rejects every other staging ref when generation is enabled", () => {
  for (const ref of ["isolated-test", STAGING_REF.toUpperCase(), `${STAGING_REF} `, `${STAGING_REF}x`]) {
    assertRejected({
      ...enabled,
      NEXT_PUBLIC_INKSTORY_STAGING_REF: ref,
      NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`
    });
  }
});

test("next config rejects a present nonmatching Vercel project for controlled generation", () => {
  for (const projectId of ["", "another-project", VERCEL_PROJECT_ID.toLowerCase(), `${VERCEL_PROJECT_ID} `]) {
    assertRejected({ ...enabled, VERCEL_PROJECT_ID: projectId });
  }
});

test("next config fails closed on missing or malformed generation flags despite the override", () => {
  for (const value of [undefined, "", "TRUE", "True", "1", "yes", " true ", "true\n", "FALSE", " false ", "0"]) {
    assertRejected({ ...enabled, INKSTORY_GENERATION_ENABLED: value });
  }
});

test("next config fails closed on malformed controlled overrides when generation is enabled", () => {
  for (const value of ["", "TRUE", "True", "1", "yes", " true ", "true\n", "FALSE", " false ", "0"]) {
    assertRejected({ ...enabled, INKSTORY_CONTROLLED_STAGING_TEST: value });
  }
});

test("next config leaves non-staging behavior unchanged", () => {
  for (const environment of [undefined, "development", "production"]) {
    const result = loadNextConfig({
      ...enabled,
      NEXT_PUBLIC_INKSTORY_ENVIRONMENT: environment,
      NEXT_PUBLIC_INKSTORY_STAGING_REF: PRODUCTION_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      VERCEL_PROJECT_ID: "another-project"
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes("X-Robots-Tag"), false);
  }
});
