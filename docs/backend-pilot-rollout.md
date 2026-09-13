# Invite-only free pilot: backend rollout

## Current scope and non-actions

This change is local code and an **unapplied** migration. It does not apply SQL to Supabase, change production environment variables, push code, deploy, send invitations, or call OpenAI. Real paid checkout is deliberately unavailable; existing `paid` and `mock_paid` rows must not be treated as verified payment evidence.

## Defense boundaries

1. Anonymous demo generation always returns 403; purchase always returns 410. Neither endpoint imports a provider or database client.
2. Authenticated generation requires the exact environment value `INKSTORY_GENERATION_ENABLED=true`, a verified signed-in user, an enabled singleton `pilot_config` row, and an active `pilot_members.allowlisted=true` row. User metadata, request bodies and signup cannot enable eligibility.
3. Each image is charged by `pilot_reserve_generation` before its one OpenAI request. Reservations are serialized on the singleton configuration row. Defaults are **6 images per user and 30 globally in a rolling 24 hours**, not calendar days. The limits and 300-second lease duration are operator-controlled in the database.
4. Failed provider calls, timeouts, missing images, failed uploads, failed saves and abandoned requests **remain charged**. There are no automatic OpenAI retries or quota refunds. Calls use low-quality 1024×1024 PNG output and a 45-second provider timeout. One request reserves one image, so three directions use three units.
5. A durable unique active `(brief_id, idx)` lease prevents overlapping same-direction work. Expired leases may be replaced, but still count. A request that times out or loses its lease cannot later overwrite a successful concept.
6. Direct client inserts/updates/deletes on concepts and orders are revoked, including any old column-level grants. Own-user SELECT remains, with a cross-table brief-owner check. Client brief deletion and owner reassignment are also forbidden to prevent cascade bypasses; client status writes are limited to draft/submitted.
7. Completion validates the caller's ownership, live invitation/configuration, the charged lease and its exact uploaded storage object. It archives a previous canonical concept row before atomic replacement. It cannot publish an arbitrary image URL, a different user's object, an expired/failed lease or an order/payment state. Old duplicate concept rows and old image objects remain intact.
8. The private image GET route checks both concept and brief ownership, resolves only that owner's same-brief same-bucket object, and serves raster bytes with private/no-store, no-sniff and same-origin headers. It never fetches an arbitrary stored URL. Owned legacy public/signed Supabase URLs are mapped back to their private object paths; owned legacy raster data URIs are size/signature checked. Foreign-folder, demo-folder, SVG/HTML and unsupported legacy references fail safely.

### Deliberate RPC trust model

RPCs execute as the database migration owner with a pinned search path, explicit execute grants and authenticated `auth.uid()` checks. Internal privileged functions are not executable by client roles. No service-role credential is used by the application.

Because the supported RPCs are authenticated (not server-secret) APIs, an invited person can invoke them directly for **their own** brief. They can consume their own/global pilot allowance, upload to an owned live reservation path, and complete it; they cannot edit quota/configuration rows or use this as payment, cross-user, arbitrary-path, or unrestricted concept-write authority. Do not claim that completed concepts are cryptographically attested OpenAI output. If that attestation is later required, introduce a separate narrowly scoped server-only completion credential/capability after security review. The API-side environment switch controls all paid provider calls; the DB switch also closes direct reservation/upload/completion.

### Controlled staging build exception

For `NEXT_PUBLIC_INKSTORY_ENVIRONMENT=staging`, `next.config.js` still requires a nonempty, non-production Supabase reference and its exact matching URL. Generation remains disabled by default: `INKSTORY_GENERATION_ENABLED=false` retains the existing isolated-staging behavior without requiring an override or a particular Vercel project.

An operator-approved controlled staging test may pass the build guard with generation enabled **only** when all of these conditions hold:

- `INKSTORY_GENERATION_ENABLED` is exactly `true`.
- `INKSTORY_CONTROLLED_STAGING_TEST` is exactly `true`.
- `NEXT_PUBLIC_INKSTORY_STAGING_REF` is exactly `ekeewaqospfceracerkl`; no other reference is allowed for enabled staging.
- `NEXT_PUBLIC_SUPABASE_URL` is exactly `https://ekeewaqospfceracerkl.supabase.co`.
- If `VERCEL_PROJECT_ID` is present, it is exactly `prj_KZL8MikMxfpdq9SiiMquOWt6Y2y9`. An absent value permits local checks; an empty or mismatched value does not.

Missing or malformed generation flags fail closed. The controlled override must be present and exactly `true` to enable staging generation; case changes, whitespace and truthy substitutes do not qualify. When generation is explicitly `false`, the override is ignored. The production database reference `yawmspiblfzzsosyeboc` and mismatched URLs remain forbidden in staging even with the override. Staging no-index headers and non-staging behavior are unchanged.

**This is only a Next.js configuration/build-guard exception, not runtime authorization.** It does not change database configuration, quotas, invitations, allowlist membership/expiry, authentication, reservation charging, storage checks or runtime generation gates. An enabled build still requires the existing environment gate, enabled database pilot switch, valid invitation and available per-user/global quota. The override alone neither enables generation nor grants anyone access. Use only for an approved isolated test; return the app gate to `false` and remove/disable the override afterward. Keep production generation disabled.

## Migration behavior and safety

`supabase/migrations/202609120001_invite_only_free_pilot.sql` is a one-time transactional migration. It intentionally fails if pilot objects already exist; use the migration ledger rather than rerunning fragments.

- Creates configuration **disabled**, with an **empty allowlist**.
- Preserves every existing brief, concept, order and storage object. No DELETE statements or destructive deduplication are used.
- Adds cross-owner composite foreign keys to concepts and orders as `NOT VALID`. This enforces new writes without failing solely because old rows mismatch. Own-user reads hide mismatches. An operator must separately investigate legacy mismatches before using `VALIDATE CONSTRAINT`; do not silently alter ownership.
- Makes the `concepts` bucket private immediately, with PNG/JPEG/WebP MIME allowlist and an 8 MiB upload limit. Existing object MIME/size is not rewritten.
- Removes every existing policy on briefs/concepts/orders and replaces them with the documented owner model. Review custom integrations that relied on broader access.
- Removes all storage policies whose expressions mention the concepts bucket. Restrictive concepts-only guards additionally close unknown bucket-agnostic wildcard policies without deleting unrelated buckets' policies. Owner-folder reads require brief ownership. INSERT requires an exact active reservation; UPDATE and DELETE are denied to clients.
- Successful regeneration keeps the canonical concept ID stable and records the previous full row in the operator-only history table. Image paths are randomized, owner/brief/reservation-bound, and uploaded with `upsert:false`. No automatic cleanup runs on old or orphaned images.

## Operator rollout checklist (separate approval required)

1. Keep generation disabled in production. Back up schema/policies and data using the normal approved operator procedure, without exposing credentials.
2. Review the migration against the actual schema, including role grants, foreign keys, custom triggers, exposed functions, unique constraints and any custom storage policies. Confirm the migration owner can create security-definer functions and alter storage policies.
3. Rehearse the full migration in a disposable Supabase staging project. The included PGlite fixture exercises PostgreSQL SQL/PLpgSQL/RLS, but does not emulate Storage HTTP, GoTrue JWTs, PostgREST, hosted limits or CDN behavior.
4. Run the offline test suite and the application's build. In staging, verify anonymous endpoints, two-user access isolation, old own-URL image retrieval, cookies/auth refresh, disabled/absent DB configuration, allowlist expiry and storage denial paths.
5. Run a real **two-connection** staging quota test: hold the config-row lock in transaction A, call reservation in B, verify B blocks until A commits, then verify B counts A's reservation and cannot exceed a near-exhausted user/global limit. PGlite is single-connection; its tests do not prove multi-process timing.
6. Coordinate migration and frontend rollout in a maintenance window. **All old public image URLs stop working when the bucket becomes private.** Every authenticated `<img>` source must use `/api/concept-image/<id>`, and all direct browser concept/order/privileged-status writes must be removed. Existing publicly cached/copied content cannot be recalled merely by changing bucket privacy; previously issued signed URLs may remain usable until their expiry.
7. Apply the migration only with approval. Confirm `pilot_config.enabled=false`, zero invited accounts, the private bucket, and client write denial before enabling generation.
8. Add only explicitly approved user UUIDs to `pilot_members` through the operator channel. Set sensible expiries and retain the default small quotas. Configure provider/project spend alerts and operator monitoring separately; image-count limits are not a currency-budget guarantee.
9. Only after staging acceptance, enable both the approved app environment gate and database switch. Pause immediately by setting `pilot_config.enabled=false`; this also rejects in-flight uploads/completions, although a provider request already started may still incur cost.
10. Observe failed/expired reservations, quota denials, latency and storage failures. Do not refund reservations automatically. For failed uploads/saves, tell participants that previous artwork is retained and allowance is conservatively counted.

## Rollback / incident response

First set the database switch to false and disable the app environment gate. Do not automatically restore public storage, permissive writes, anonymous generation or mock checkout as a rollback strategy. Old app code is incompatible with the hardened private-storage/write model; prefer a generation-disabled maintenance UI while fixing issues. Preserve reservations, historical concepts and all objects for investigation.

## Offline verification

From the repository root, use the supported Node 24 runtime and installed development dependencies:

```sh
npm test
```

For backend tests alone:

```sh
npx tsx --test tests/security.test.ts tests/pilot-sql.test.ts
```

`tests/fixtures/pilot-schema.sql` is **test-only**. Tests instantiate a fresh in-memory PGlite database, apply the complete migration, execute authenticated/anonymous role scenarios and roll back each test. It deliberately includes broad legacy storage policies, column-level grants, a historical cross-owner mismatch and fake historical order so preservation and denial are exercised. Provider calls are mocked; no production URL, real token or OpenAI request is used.

## Remaining work before a paid launch

Implement a separately reviewed payment-provider checkout, signed/idempotent webhook processing, server-authoritative pricing/order transitions, refund reconciliation and verified download entitlements. Also review abuse beyond generation (signup, draft storage, authentication/email), data-retention/deletion procedures, account removal blocked by historical foreign keys, content/moderation policy, archival access, provider spend controls, monitoring and backups. Nothing in the free-pilot change implements those features.
