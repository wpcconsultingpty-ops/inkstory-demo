# Backend pilot contracts

For the coordinating/frontend agent:

- `POST /api/demo-generate` and `/api/demo-generate-one` always return **403** with `{ error, detail }`; no image generation or database calls.
- `POST /api/purchase` always returns **410** with `{ error, detail }`; paid checkout is unavailable and makes no writes.
- `POST /api/generate` accepts `{ brief_id: UUID }`, checks authentication, origin, validated persisted brief, environment gate and durable pilot eligibility. Returns `{ ok: true }`. It marks `submitted` but **does not delete/reset existing concepts**. Remove any UI promises that this clears/replaces all artwork.
- `POST /api/generate-one` accepts `{ brief_id: UUID, idx: 0 | 1 | 2 }`; returns `{ concept }` only after successful image upload and durable save. `concept.image_url` and `thumbnail_url` in the response are `/api/concept-image/<concept UUID>`. Existing concept rows persist on failure; concurrent requests for the same brief/direction receive **409**.
- Render **every authenticated concept** with `/api/concept-image/${concept.id}` (including initially loaded rows). Stored `image_url` becomes a private storage object path, not a public URL. GET requires the owning signed-in user, returns a raster image with no-store headers, and does not redirect to a public URL.
- Error responses use `{ error: string, detail?: string }`: 400 validation, 401 sign-in, 403 origin/invite, 404 inaccessible brief/image, 409 in-flight duplicate, 413 body too large, 429 durable pilot quota, 503 disabled/unavailable. UI must not auto-retry 429/503 or advertise unlimited generation.
- **Shared validation interface:** `src/lib/security.ts` exports `BRIEF_LIMITS`, `MAX_BRIEF_LENGTH = 6000`, `validateBrief(value: unknown): BriefDraft` (trimmed copy, throws `RequestError` with `status` and readable `message`), `validateUUID(value: unknown, field?: string): string`, and `validateDirectionIndex(value: unknown): number`. `security.ts` is browser-safe (no secrets, Buffer, server imports). Meaning minimum 10; placement/size/style/palette/key_elements required; reference_notes optional.
- Do not write `concepts`, `orders`, or `brief.status = concepts_ready/purchased` from the browser. Completion sets ready status transactionally. Ordinary draft/submitted brief edits remain allowed. Existing paid/mock_paid rows are retained but are **not trusted payment evidence**.
- Save account briefs with separate INSERT and allowed-field UPDATE calls. Keep a stable client-generated UUID across retries; look up that UUID with the signed-in owner before deciding which operation to use. Do **not** use an upsert payload containing `id` or `user_id`: PostgreSQL requires forbidden UPDATE privileges for those merge columns. If an insert response is lost or a duplicate-ID race occurs, retry the owned lookup/update pattern; never grant ownership-column UPDATE to make upsert work.
- Deployment remains generation-disabled unless **both** `INKSTORY_GENERATION_ENABLED=true` and operator-controlled database pilot configuration/allowlist are enabled. Neither account signup nor user metadata grants eligibility.

Next 15 compatibility: all server clients are awaited, and the image route awaits promised route params.

**Migration contract fixed:** `supabase/migrations/202609120001_invite_only_free_pilot.sql` creates operator-only `pilot_config`, `pilot_members`, `pilot_generation_reservations`, and `pilot_concept_history`. Authenticated RPCs are `pilot_prepare_brief(p_brief_id)`, `pilot_reserve_generation(p_brief_id,p_idx)`, `pilot_complete_generation(p_reservation_id,p_prompt,p_meta)`, and `pilot_fail_generation(p_reservation_id)`. No service-role application credential is required.

Direct concept/order writes are revoked, including historical column grants. Completion can only publish an owned uploaded object matching a charged, unexpired reservation; successful regeneration archives the previous complete concept row before updating its canonical row. All old storage objects are retained. Existing duplicate directions are preserved: **when selecting initial concepts, use newest `created_at DESC, id DESC` within each `idx`** to match the backend's canonical selection. Do not use a paid/mock_paid order to unlock any pilot UI.

Offline verification: **27 backend tests pass** (11 security/API/provider-helper scenarios and 16 isolated PostgreSQL/PGlite migration/RLS/quota/validation-parity/account-save scenarios); full TypeScript check is clean. Run `npm test` with the parent's Node 24 environment. No OpenAI or production service calls are made by these tests.

Migration and rollout details are in `docs/backend-pilot-rollout.md`.
