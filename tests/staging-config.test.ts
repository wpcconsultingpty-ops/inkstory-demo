import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { supabaseConfig } from "../src/lib/supabase/config";

test("staging config rejects production and mismatched database references", () => {
  const saved = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_INKSTORY_ENVIRONMENT = "staging";
    process.env.NEXT_PUBLIC_INKSTORY_STAGING_REF = "yawmspiblfzzsosyeboc";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://yawmspiblfzzsosyeboc.supabase.co";
    assert.throws(supabaseConfig, /isolation/);
    process.env.NEXT_PUBLIC_INKSTORY_STAGING_REF = "isolated-test";
    assert.throws(supabaseConfig, /isolation/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://isolated-test.supabase.co";
    assert.equal(supabaseConfig().url, process.env.NEXT_PUBLIC_SUPABASE_URL);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("staging banner stays accurate whether public generation is enabled or disabled", () => {
  const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
  assert.match(layout, /STAGING · Test environment · Image generation subject to account & service limits · Payments disabled · Production is separate/);
  assert.doesNotMatch(layout, /AI generation and payments disabled/);
  assert.match(layout, /isStaging && <div/);
  assert.doesNotMatch(layout, /["']use client["']/);
});
