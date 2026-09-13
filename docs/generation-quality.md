# Personalised generation quality

Implementation notes for the generation art-direction upgrade, updated 13 September 2026. New requests remain on-body only, with the gallery presentation as the visual target. Version 5 strengthens anatomical side and surface centring without changing saved brief fields, model settings or release gates.

## Shared frontend/server contract

`src/lib/generation-plan.ts` is browser-safe. It imports only the brief serializer and existing browser-safe validation; it does not import credentials, provider code, gallery assets or server clients.

```ts
type OutputMode = "on_body";

OUTPUT_MODES // readonly [{ id, label, description }, ...]
// on_body: On-body mockup

GENERATION_DIRECTIONS // readonly [{ id, label, description }, ...]
// 0: Focused symbol
// 1: Balanced composition
// 2: Immersive narrative

validateOutputMode(value: unknown): OutputMode
validateGenerationPrompt(value: unknown): string // 1–10000 Unicode code points
buildGenerationPlan(brief: BriefDraft, idx: number, outputMode: OutputMode = "on_body")
// returns {
//   label, description, outputMode, outputLabel,
//   size, quality, model, promptVersion, prompt, placementNote, styleNote
// }
```

Use these exact shared labels, descriptions and plan notes in the review interface. The server builds the actual prompt from the **reserved database brief snapshot**, not from client-submitted creative data. An unsaved browser preview is not authoritative.

`POST /api/generate-one` accepts only:

```json
{
  "brief_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "idx": 0,
  "output_mode": "on_body"
}
```

Omitting `output_mode` defaults to `on_body` for existing callers. `artwork` is rejected, as are explicit `null`, empty strings, booleans, numbers, unknown values, altered casing and surrounding whitespace: **400**, before authentication, the environment gate or quota reservation. Extra request fields including `model`, `quality`, `size`, `n`, `prompt`, `brief`, `output_format` and timeout controls also return **400**. On-body output never grants pilot eligibility or bypasses the existing gates.

The UI has no output-format selector. The exact saved body placement is prominent in the plan and confirmation, and the client submits the literal `on_body` value. Historical images retain their existing output labels through a separate `SavedOutputMode` metadata type; no existing artwork is deleted, regenerated or relabelled.

## Fixed server policy

| Field | Policy |
| --- | --- |
| Model | `gpt-image-2.5-flare` |
| Quality | `high` |
| Size | `1024x1536` (portrait, all placements) |
| Format | PNG |
| Count | `n: 1` |
| Automatic retries | None |
| Prompt version | `inkstory-generation-v5` |

The selected model and image-generation parameters use the official OpenAI images generation API contract supplied for this upgrade: [OpenAI — Generate images](https://developers.openai.com/api/reference/resources/images/methods/generate/) (`https://developers.openai.com/api/reference/resources/images/methods/generate/`).

The provider helper does not expose model, quality, image count or size options. Its only option is `expiresAt`, passed from the durable reservation. Requests always use the fixed Flare alias. A returned `model` may be exactly that alias or the documented snapshot `gpt-image-2.5-flare-2026-09-08`; the actual accepted response value is saved. If the response omits `model`, metadata records the requested alias rather than inventing a resolved snapshot. Other model values—including arbitrary dates, nulls and other model families—fail without a retry. The alias and snapshot are documented in [OpenAI — Generate images](https://developers.openai.com/api/reference/resources/images/methods/generate/) (`https://developers.openai.com/api/reference/resources/images/methods/generate/`).

Optional response size, quality and output-format metadata must match the fixed portrait/high/PNG policy. The request never follows provider image URLs or switches to another model.

Completion persists:

```ts
{
  variant: plan.label,
  detail: plan.description,
  output_mode: plan.outputMode,
  prompt_version: plan.promptVersion,
  model: generated.model,
  size: generated.size,
  quality: generated.quality
}
```

The compiled prompt itself is retained as `p_prompt`. Metadata describes the policy and requested output; it is not a claim that visual fidelity, footer legibility or tattooability has been independently verified.

## Personalisation and art direction

- **Saved data, not a template:** `buildPrompt` serializes only the seven existing `BriefDraft` fields as length-delimited raw text, not escaped JSON. Each header names the field and its Unicode code-point length, followed by the exact field value. Quotes, backslashes, Unicode and line breaks are preserved without expansion. Brief types, options and validation limits are unchanged. The gallery's subjects, colour accents and compositions are not imported or injected.
- **Exclusions win:** explicit avoidance notes anywhere in the saved brief, especially `reference_notes`, take precedence over conflicting motifs, ornamental conventions and composition suggestions. Exact notes remain in the data block; they are not summarized, shortened or escaped away. If an element is both requested and excluded, the prompt instructs the model to omit it instead of using a stock replacement.
- **Technique follows style:** all nine existing style choices have their own technique guidance. Directions change hierarchy, arrangement and movement, not the requested art technique. Fine-line, realism, neo-traditional, Irezumi, Norse/runic, illustrative, minimal geometric, watercolour and bold traditional are not all forced into single-needle drawing, bold flash or stippling. Custom styles keep their own described visual language.
- **Palette is strict:** pigment constraints are independent of the skin/background presentation. A restricted palette overrides style conventions; black-line only does not acquire coloured washes or grey shading.
- **Size controls complexity:** small sizes and hand/wrist/finger/ankle/ear placements simplify detail—even for the narrative direction or a conflicting XL size. Full sleeves may use connected storytelling zones; a back uses its broader plane without automatically covering the whole back. A portrait canvas is not permission to enlarge a small tattoo.
- **Symbols and text:** Vegvisir is excluded by default, including for Norse/runic briefs. Inclusion requires an unambiguous explicit positive request and no conflicting exclusion; a reference URL or negative mention is not permission. The prompt forbids fabricated translations, pseudo-runes, invented inscriptions and cultural-authenticity claims. Tattoo text requires exact user-supplied text; the model must not invent or translate it.
- **Originality:** references describe visual qualities, not an instruction to trace tattoos, reproduce logos/protected characters or copy signature designs. No real-person likeness or identifying feature is requested.
- **Instruction boundary:** all brief fields are untrusted creative data. Embedded directions to change output, model, labels or safety are explicitly subordinated to the generation policy. Marker-like text inside a field remains data; exact field lengths allow lossless extraction even when a value contains a fake end marker. This is prompt-level defence, not proof that every model output will obey every instruction.

### Database prompt budget: no truncation or paid unsavable result

The existing completion RPC rejects prompts over **10,000 Unicode characters**. Version 5 keeps policy/data sections concise to accommodate the new anatomical guidance. It does not repeat the full style, placement, size or palette values outside the saved data block. The longer `styleNote` and `placementNote` remain available for frontend review but are not copied verbatim into the provider prompt; the same anatomical instructions appear in both preview notes and the compiled prompt.

The regression suite proves a conservative upper bound for **any valid 6,000-character saved brief**:

```text
6,000 maximum saved field characters
  204 maximum length-header/separator characters
3,750 maximum policy/presentation characters
-----
9,954 maximum prompt characters (< 10,000)
```

The policy maximum covers **12,240 combinations**, each with exactly 6,000 saved field characters: all existing styles/palettes plus custom fallbacks, all sizes and directions, generic/torso/sensitive coverage, every reachable extent branch, and both precise inner-wrist sides. Mixed custom regions exercise coverage precedence; precise wrist guidance can only select small-area, regular coverage. The longest prompt in this matrix is **9,950** characters; the conservative bound above also allows maximum-length field headers. Additional tests use 120-character placement/size fields on both wrist branches. Exact round-trip tests cover quotes, backslashes, supplementary Unicode, allowed whitespace and fake data markers, including both enriched wrist fixtures; no exclusion is truncated. The remaining 46-character conservative margin is small: future policy edits must rerun the full bound test rather than assume the prompt still fits.

`validateGenerationPrompt` remains a separate browser-safe helper, so `buildGenerationPlan` does **not** throw a length error during React rendering. The route explicitly validates the entire compiled prompt from the owned saved brief **before reservation**, and validates the reserved snapshot's freshly compiled prompt again before provider access. Future policy growth or unexpected oversized data therefore produces a readable **400** rather than a paid image that cannot be saved. Preflight overflow performs no reservation or provider call; snapshot overflow sends no provider request and releases the already-counted reservation under the existing no-refund rules.

### On-body mockup

Every new request mandates the exact anatomical area in the saved placement field. Left/right means the **wearer's anatomical side**, not the viewer's or canvas side; mirroring and substituting another region are forbidden. Specified inner/outer and orientation are preserved. Other fields cannot change the anatomical area/side/surface or switch to standalone art. All three directions keep that same area, natural scale and curvature.

Centring is relative to the **selected skin surface at the tattoo's height**, not the frame centre or the centre of the entire limb. It is a default, not a correction of deliberately off-centre placement: explicit offsets and design asymmetry within the selected surface must be honoured, including notes in other saved fields. The policy does not impose symmetry or a universal front-facing pose on calves, forearms, backs, sleeves, torso crops or other regions.

Only an unambiguous single **left/right inner or palm-facing wrist** receives a precise view rule:

- Straight-on, palm facing the camera, fingers up; the wearer's **RIGHT** wrist has its thumb on **viewer-left**, and the wearer's **LEFT** wrist has its thumb on **viewer-right**.
- Show enough hand and wrist to verify that handedness; do not crop away the evidence.
- Unless explicitly offset, centre between the two wrist skin edges at tattoo height. Keep ink above the wrist crease on the forearm side, with no hand/palm spill.

The conservative classifier reads only `placement`, never side mentions in story, style, elements or reference notes. It recognizes common anatomical word orders, casing/spacing, parentheses and comma/semicolon qualifiers for the same inner/palm-facing surface, centring above the crease, offsets, asymmetry and orientation. The exact regression fixture is `Right inner wrist, palm-facing surface, centred above the wrist crease`, with a corresponding left-hand fixture. Bilateral, unspecified, outer/dorsal, contradictory or unrecognized freeform placements retain the general anatomical guidance instead of a guessed thumb rule. Classification never rewrites or truncates saved data.

The gallery presentation is a concrete rendering target: photoreal studio view, natural skin texture, crisp tattoo edges and tonal depth, ink following curved skin rather than a pasted decal, soft side-light and a charcoal background. No plastic skin, CGI gloss, props or extra limbs. The chosen tattoo technique, palette, motifs and suitable detail level remain personal to the brief; gallery subjects are not copied or automatically inserted.

Torso, rib, chest, hip and thigh placements require modest crops and opaque intimate coverage. If coverage would hide the requested area, the prompt uses an anatomically relevant non-explicit body form of that same area, not another body part or flat artwork. Sensitive or identifying placements likewise use a non-explicit form without intimate detail or a recognizable face. No child or real person's face is requested.

The exact visible footer **AI CONCEPT MOCKUP** is requested outside the tattoo/body area. It must be inspected in a future visual acceptance test; prompt instructions alone do not establish successful text rendering.

### Historical artwork-only images

Artwork-only generation is no longer offered or accepted. Existing saved artwork-only images remain private and viewable with their original labels; legacy results with unknown settings remain labelled unknown rather than inferred as on-body.

New concepts reject unrealistic microdetail and tiny packed lines. These are discussion references, not stencils, evidence of real healed tattoos or guarantees of an artist's approval or tattoo safety. This implementation specifies presentation and placement; it does not automatically inspect generated pixels or prove compliance with that standard.

## Lease, spend and storage protections

1. Origin, body, UUID, direction and output/request-key validation run first.
2. Authentication, explicit environment enablement, owned-brief validation, complete-prompt length preflight and API-key presence remain required.
3. `pilot_reserve_generation` still checks database eligibility/quotas and durably charges the reservation **before** provider access.
4. After rebuilding and length-checking the reserved snapshot prompt, immediately before fetch the server computes:

   ```text
   available_ms = Date.parse(reservation.expires_at) - Date.now() - 30_000
   provider_timeout_ms = min(180_000, floor(available_ms))
   ```

   Missing, malformed, timezone-less or expired timestamps fail closed. Less than **45,000 ms** of available provider time also fails with **409**, without sending a provider request. The existing default 300-second lease permits the 180-second provider cap; a fresh minimum 120-second lease permits at most 90 seconds. Network time already consumed after reservation reduces that allowance.

5. Route `maxDuration` is **240 seconds**. The provider timeout leaves a **30-second lease margin** for response validation, private storage upload and atomic completion. This margin is a budget, not a guarantee: delayed storage/completion can still fail, and the database independently rejects expired reservations.
6. No automatic retry, fallback model or refund path is added. Provider failures, timeouts and post-reservation preflight failures release the slot through `pilot_fail_generation`, but the existing rolling allowance charge remains counted.
7. Responses must be JSON, contain exactly one base64 PNG result and stay within the existing 12 MiB response-body and **8 MiB decoded image** limits. Existing base64 and PNG-signature checks are preserved; they are not a full raster decoder, dimension verifier or visual-safety classifier.
8. Upload stays in the private `concepts` bucket with `upsert: false`, under the owned reservation path. The route calls the same atomic `pilot_complete_generation` RPC only after upload. No old image or concept is deleted first; existing database archival replacement behavior is unchanged.
9. Returned images remain `/api/concept-image/<concept UUID>` with no-store handling, not public bucket links.

No authentication, database schema, migrations, quota values, environment configuration or archive rules are changed by this upgrade.

## Offline verification and release gate

Run with Node 24:

```sh
export PATH=/home/user/workspace/inkstory-runtime/node_modules/node/bin:$PATH
npm run typecheck
npx tsx --test tests/generation-plan.test.ts tests/security.test.ts
npm test
```

Results at implementation verification:

- **Runtime:** Node **24.21.0**.
- **TypeScript:** `npm run typecheck` passes.
- **Full offline suite:** `npm test` — **118 passed, 0 failed**, including all **41** generation-plan tests, the 12,240-combination prompt bound, exact wrist fixtures and negative classifier cases, mandatory placement, gallery presentation across every style/direction, rejected artwork requests, historical metadata and the existing privacy/quota regressions.

Tests cover every existing style, strict palettes, exact exclusions, no injected gallery motifs, on-body-only validation, all placement/size options, safe anatomical forms, the full prompt-budget bound, lossless maximum-length brief serialization, overflow rejection before reservation and on a changed snapshot, mode validation before auth/gates, fixed provider payload, exact alias/snapshot acceptance with actual model metadata, timeout bounding, invalid/oversized/mismatched responses, no retries, saved-snapshot prompt assembly, reservation ordering, private URLs and non-destructive failure paths. Route orchestration uses the actual route source with narrow offline dependency doubles; it does not prove hosted authentication, network latency or provider success.

**This v5 implementation and verification used no live image requests, credentials, database/environment changes, commits, pushes or deployments. Generation was not enabled.** The code changes are limited to the shared generation plan, its tests and this document; release operations remain separate. No claim is made that personalised generation already matches the gallery's visual quality or that the reported wrist handedness/centring failure is visually resolved. Prompt-level tests are not pixel inspection or evidence that the hosted OpenAI route works.

Before enabling generation, the release owner should run an explicitly authorized, budgeted end-to-end test through the real disabled-by-default app gates and inspect:

- style preservation and strict exclusions across at least a small-area design and a larger composition;
- on-body anatomy, coverage, framing, full motif visibility and readable mockup footer;
- exact selected body area, left/right, inner/outer and orientation across all three directions, with no standalone artwork;
- wrist handedness in the specified palm-facing, fingers-up view (right thumb viewer-left; left thumb viewer-right), enough anatomical context, skin-edge centring at tattoo height and no palm spill;
- intentional off-centre placement and asymmetric motifs remaining intentional, and non-wrist/outer/dorsal placements not inheriting the inner-wrist pose;
- gallery-level skin/ink integration, clarity, lighting and framing without copying gallery subjects;
- actual provider latency against the returned lease, response size, private upload and completion;
- saved prompt/metadata, private retrieval and successful archival replacement;
- unchanged existing art and counted allowance on a controlled failure.

Do not enable staging or production generation merely because offline tests or a separately generated editorial image pass.
