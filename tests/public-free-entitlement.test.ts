import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { NextResponse } from "next/server";
import { parseGenerationEntitlement, entitlementMessage, refreshGenerationEntitlement, type GenerationEntitlement } from "../src/lib/generation-entitlement";
import { readGenerationEntitlement, rpcError, apiFailure } from "../src/lib/pilot-server";
import { RequestError } from "../src/lib/security";
import GenerationAllowance from "../src/components/GenerationAllowance";
import GenerationReview from "../src/app/concepts/[id]/GenerationReview";
import { generationError } from "../src/components/pilot-client";

Object.assign(globalThis, { React });
const available: GenerationEntitlement = { tier: "public_free", reason: "available", remaining: 1, limit: 1, can_generate: true };
const used: GenerationEntitlement = { ...available, reason: "used", remaining: 0, can_generate: false };
const owner: GenerationEntitlement = { tier: "allowlisted", reason: "available", remaining: 7, limit: 10, can_generate: true };
const brief = { meaning: "A meaningful fictional tree", placement: "Forearm", size_cm: "10 cm", style: "Fine-line", key_elements: "Tree", palette: "Black", reference_notes: "" };

test("entitlement parser allowlists safe fields and fails closed on invalid or inconsistent responses", () => {
  assert.deepEqual(parseGenerationEntitlement({ ...available, email: "secret@example.invalid", user_id: "secret", prompt: "secret" }), available);
  for (const value of [null, [], "available", {}, { ...available, tier: "admin" },
    { ...available, reason: "free_retry" }, { ...available, can_generate: "true" },
    { ...available, remaining: -1 }, { ...available, remaining: 2 }, { ...available, remaining: 0.5 },
    { ...available, remaining: 0 }, { ...available, limit: 10 },
    { ...owner, limit: 101 }, { ...available, reason: "used" },
    { ...available, tier: "unverified" },
  ]) assert.equal(parseGenerationEntitlement(value), null, JSON.stringify(value));
});

test("public available/used copy is lifetime per account, not daily, per direction or a successful-result promise", () => {
  assert.match(entitlementMessage(available), /One lifetime free generation attempt available/);
  assert.match(entitlementMessage(available), /across all briefs and directions/);
  assert.match(entitlementMessage(available), /even if generation fails or expires/);
  assert.match(entitlementMessage(used), /has been used/);
  assert.match(entitlementMessage(used), /does not reset with time/);
  assert.match(entitlementMessage(used), /manual review only/);
  assert.match(entitlementMessage(owner), /7 of 10 attempts remaining.*rolling 24-hour/);
  assert.match(entitlementMessage(null), /could not confirm.*unavailable/);
  for (const state of ["paused", "not_enabled", "global_quota"] as const) {
    const html = renderToStaticMarkup(React.createElement(GenerationAllowance, { entitlement: { ...available, reason: state, can_generate: false } }));
    assert.match(html, /Your image allowance/);
    assert.doesNotMatch(html, /unlimited|free retries/);
  }
});

test("review confirmation is disabled for used, unverified, expired, paused, missing or full-capacity entitlement", () => {
  for (const state of [
    used, null, { ...available, reason: "paused", can_generate: false },
    { ...available, reason: "global_quota", can_generate: false },
    { tier: "unverified", reason: "unverified", remaining: 0, limit: 0, can_generate: false },
    { tier: "blocked", reason: "blocked", remaining: 0, limit: 0, can_generate: false },
  ] as (GenerationEntitlement | null)[]) {
    const html = renderToStaticMarkup(React.createElement(GenerationReview, {
      brief, request: { index: 1, replacement: false }, previewOnly: false,
      entitlement: state, onCancel() {}, onConfirm() {},
    }));
    assert.match(html, /disabled="" data-testid="button-confirm-generation"/);
    assert.match(html, /No retries or automatic replacements/);
  }
  for (const entitlement of [available, owner]) {
    const html = renderToStaticMarkup(React.createElement(GenerationReview, {
      brief, request: { index: 0, replacement: false }, previewOnly: false,
      entitlement, onCancel() {}, onConfirm() {},
    }));
    assert.doesNotMatch(html, /disabled=""/);
    assert.match(html, /data-testid="review-allowance"/);
  }
});

test("status-specific generation errors never imply a public lifetime reset or free retry", () => {
  for (const status of [409, 429, 503, 502]) {
    assert.doesNotMatch(generationError(status), /before retrying|try again later|before trying again/);
  }
  for (const [code, status] of [
    ["pilot_email_unverified", 403], ["pilot_access_revoked", 403], ["pilot_lifetime_used", 409],
    ["pilot_global_quota", 429], ["pilot_quota", 429],
  ] as const) {
    assert.throws(() => rpcError({ message: code }), (e: unknown) => e instanceof RequestError && e.status === status);
  }
  assert.throws(() => rpcError({ message: "raw SQL secret@example.invalid" }),
    (e: unknown) => e instanceof RequestError && !e.message.includes("secret"));
});

test("server entitlement reflects the environment kill switch and unknown DB errors fail closed", async () => {
  const previous = process.env.INKSTORY_GENERATION_ENABLED;
  const client = (data: unknown, error: unknown = null) => ({
    rpc: async (name: string) => { assert.equal(name, "pilot_generation_entitlement"); return { data, error }; },
  }) as unknown as Parameters<typeof readGenerationEntitlement>[0];
  try {
    process.env.INKSTORY_GENERATION_ENABLED = "true";
    assert.deepEqual(await readGenerationEntitlement(client(available)), available);
    assert.deepEqual(await readGenerationEntitlement(client(owner)), owner);
    assert.equal(await readGenerationEntitlement(client(available, { message: "PRIVATE DB ERROR" })), null);
    assert.equal(await readGenerationEntitlement(client({ reason: "available" })), null);
    process.env.INKSTORY_GENERATION_ENABLED = "false";
    assert.deepEqual(await readGenerationEntitlement(client(available)), { ...available, reason: "paused", can_generate: false });
    assert.deepEqual(await readGenerationEntitlement(client(used)), used);
  } finally {
    if (previous === undefined) delete process.env.INKSTORY_GENERATION_ENABLED;
    else process.env.INKSTORY_GENERATION_ENABLED = previous;
  }
});

test("refresh performs exactly one read-only request; errors never trigger retries or generation", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    calls++;
    assert.equal(url, "/api/generation-entitlement");
    assert.deepEqual(init, { credentials: "same-origin", cache: "no-store" });
    return NextResponse.json(used);
  });
  assert.deepEqual(await refreshGenerationEntitlement(), used);
  assert.equal(calls, 1);
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("network"); });
  assert.equal(await refreshGenerationEntitlement(), null);
  assert.equal(calls, 2);
});

function offlineEntitlementRoute(options: { signedIn?: boolean; data?: GenerationEntitlement | null; fail?: boolean } = {}) {
  const calls: string[] = [];
  const supa = { auth: { getUser: async () => {
    calls.push("auth");
    return { data: { user: options.signedIn === false ? null : { id: "only-current-user" } }, error: null };
  } } };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => supa },
    "@/lib/pilot-server": { apiFailure, readGenerationEntitlement: async (client: unknown) => {
      assert.equal(client, supa);
      calls.push("read-current-entitlement");
      if (options.fail) throw new Error("SQL SECRET");
      return options.data === undefined ? available : options.data;
    } },
    "@/lib/security": { RequestError },
  };
  const source = readFileSync(resolve(import.meta.dirname, "../src/app/api/generation-entitlement/route.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as { GET: () => Promise<Response> } };
  new Function("require", "module", "exports", js)((id: string) => {
    assert.ok(Object.hasOwn(dependencies, id), `Unexpected outbound dependency ${id}`);
    return dependencies[id];
  }, module, module.exports);
  return { GET: module.exports.GET, calls };
}

test("entitlement route authenticates, returns no-store safe status, uses no provider and does not consume", async () => {
  const route = offlineEntitlementRoute({ data: owner });
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), owner);
  assert.deepEqual(route.calls, ["auth", "read-current-entitlement"]);
});

test("entitlement route denies anonymous and safely reports missing/malformed service results", async () => {
  const anonymous = offlineEntitlementRoute({ signedIn: false });
  assert.equal((await anonymous.GET()).status, 401);
  assert.deepEqual(anonymous.calls, ["auth"]);
  for (const options of [{ data: null }, { fail: true }]) {
    const response = await offlineEntitlementRoute(options).GET();
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.doesNotMatch(await response.text(), /SQL SECRET|OPENAI|service_role/);
  }
});

test("signup remains email-verified, scoped to same-app brief return; no provider/prompt changes", () => {
  const home = readFileSync(resolve("src/app/page.tsx"), "utf8");
  const login = readFileSync(resolve("src/app/auth/login/LoginForm.tsx"), "utf8");
  const grid = readFileSync(resolve("src/app/concepts/[id]/ConceptsGrid.tsx"), "utf8");
  assert.match(home, /href="\/auth\/login\?next=\/brief"/);
  assert.match(home, /one lifetime free generation attempt/);
  assert.match(login, /supabase\.auth\.verifyOtp/);
  assert.match(login, /shouldCreateUser: true/);
  assert.match(login, /safeReturnPath/);
  assert.match(grid, /if \(!previewOnly && !entitlement\?\.can_generate\) return/);
  assert.match(grid, /setEntitlement\(null\)/);
  assert.match(grid, /setEntitlement\(await refreshGenerationEntitlement\(\)\)/);
});
