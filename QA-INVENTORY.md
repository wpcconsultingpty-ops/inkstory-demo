# InkStory launch-readiness QA inventory

This checklist defines the claims to verify before rollout. A passing local check is not a claim that production was changed.

## User-visible checks

- Public landing: accurate early-access wording; no active purchase, unlimited-generation or false browser-local AI promise.
- Local planning flow: required information, per-step errors, back/forward preservation, review, example-layout labels and useful brief export.
- No-cost preview: completing the local flow makes no AI-generation or purchase request.
- Storage unavailable: browser storage denial degrades to in-memory drafts with an accurate notice, without a crash.
- Account path: sign-in is required; missing configuration is handled; no mock order can unlock anything.
- Account generation: non-members, disabled generation and exhausted quotas produce clear errors rather than empty “success”.
- Export: printed brief includes entered content, exclusions/notes and artist-responsibility wording; no claim that it is a paid final tattoo design.
- Responsive review: desktop 1440 × 1000 and mobile 390 × 844, including populated review and errors.
- Privacy and pilot scope links: accessible, readable, consistent with actual data flow and operating boundaries.

## Backend and data checks

- Anonymous image routes cannot reach the provider.
- Purchase route cannot write mock or real paid orders.
- Malformed/oversized JSON, invalid UUIDs, fractional/out-of-range indices and blank/oversized briefs are rejected.
- Cross-origin writes are rejected when an Origin is supplied.
- Non-owner image access fails; private object paths cannot escape the authenticated owner’s namespace.
- Database quota reservations are atomic, default-disabled and protected from client mutation.
- Per-user/global caps and duplicate reservations are covered.
- Storage bucket is private after migration; former broad/anonymous policies are removed.
- Owner-only access survives; cross-owner updates/deletes and forged order writes are denied.
- Failed generation preserves existing art and does not become a successful concept.
- Production build, TypeScript and dependency audit pass.

## Off-happy-path exploration

- Empty brief through all steps, long fields and a non-Latin/HTML-like story.
- Reload/reopen a saved local brief; disable browser storage; repeated button clicks.
- No environment configuration; generation disabled; old anonymous/purchase URLs.

## Explicit exclusions until separately verified

No live OpenAI spend, production authentication email, real payment or production cross-account test is authorised by this QA plan. Real payment integration and paid-pack delivery stay closed; migration application and production deployment require a separate reviewed rollout.
