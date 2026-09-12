# InkStory repair verification

Status: implemented and verified locally on 12 September 2026. Production is unchanged. This is not approval for public traffic or paid sales.

## Automated checks

- Node 24; Next.js 15.5.25.
- `npm test`: 30 tests passed, none failed.
- `npm run typecheck`: passed.
- `INKSTORY_BUILD_DIR=.next-production npm run build`: passed, including all 14 static pages.
- `npm audit --audit-level=low`: zero reported vulnerabilities at this run.
- Isolated Vite preview build: passed. It imports the real public components but has no account connection, AI provider or payment integration.

The test suite executes the complete migration in PGlite with test-only data and simulated authenticated/anonymous PostgreSQL roles. It covers preserved historical rows, private storage, ownership, direct-write denial, stable-ID account saves, validation, allowlisting, disabled generation, rolling quotas, duplicate leases, expiration, archival replacement, atomic completion and replay denial. Provider responses are mocked.

## Browser checks

Chromium desktop (1440×1000) and mobile (390×844) were exercised through real controls.

- Empty meaning rejected with visible validation.
- All five local brief steps completed with story, placement, size, style, palette, elements and Unicode notes.
- Captured fields present in review and example-layout view.
- Layout choice retained in text export and printable discussion brief.
- Plain text download saved successfully.
- Print control invoked; browser-generated PDF contained the captured fields and Unicode text, including café and 日本語. This is a text-only brief, not an artwork PDF pack.
- Saved local brief appeared in the dashboard; clear-data control returned the empty state.
- Blocked localStorage produced a clear memory-only warning and still allowed the flow to continue.
- Missing brief displayed a recovery page, not a broken screen.
- Sample, privacy and pilot-scope navigation worked in the isolated preview.
- No write requests were observed while entering and saving a brief in the isolated preview.
- No page errors observed in the tested mobile and isolated-preview sessions.
- Inspected mobile landing, sample and validation states had no horizontal overflow, text overlap or obscured primary control. Desktop landing and layout cards were visually reviewed.

Production-mode local endpoint checks returned:

| Endpoint | Expected result |
| --- | --- |
| `/` | 200 |
| `/api/demo-generate` | 403, anonymous generation disabled |
| `/api/demo-generate-one` | 403, anonymous generation disabled |
| `/api/purchase` | 410, no payment or order created |
| `/api/generate` and `/api/generate-one` | 503 with services unconfigured; no provider calls |

## Explicitly unverified

- Hosted Supabase migration, Storage HTTP, PostgREST and JWT behavior.
- Real email-code sign-in, cookie refresh, cross-account image retrieval and downloads.
- Real simultaneous reservations over two separate database connections.
- OpenAI image generation, generation cost, hosted execution duration and provider error behavior.
- Payment processing, refunds, paid entitlements or an artwork PDF product.
- Retention/deletion operations, abuse of signup or draft storage, and provider spend monitoring.

No production data was changed, no real user was invited, no email or image-generation request was sent, and no payment was taken. See `backend-pilot-rollout.md` for staging acceptance and coordinated migration/deployment requirements.
