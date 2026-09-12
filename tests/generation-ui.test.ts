import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConceptsGrid from "../src/app/concepts/[id]/ConceptsGrid";
import ConceptImage from "../src/app/concepts/[id]/ConceptImage";
import GenerationMetadata, {
  privateConcept, sanitiseConceptMeta, savedDirectionLabel, savedOutputLabel,
} from "../src/app/concepts/[id]/GenerationMetadata";
import GenerationReview from "../src/app/concepts/[id]/GenerationReview";
import { buildGenerationPlan, GENERATION_DIRECTIONS } from "../src/lib/generation-plan";
import type { BriefDraft } from "../src/lib/brief";

// tsx uses the repository's Next JSX-preserve setting; provide the classic
// runtime for offline SSR assertions without adding a DOM/test dependency.
Object.assign(globalThis, { React });

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const brief: BriefDraft = {
  meaning: "A fictional reminder of a fresh start.",
  placement: "Inner forearm",
  size_cm: "Medium (8–15cm)",
  style: "Fine-line",
  key_elements: "Oak tree; roots; crescent moon",
  palette: "Black and grey",
  reference_notes: "Avoid: lettering, birds, red ink.",
};

test("metadata allowlist bounds all strings and drops prompts, paths and unexpected data", () => {
  const safe = sanitiseConceptMeta({
    variant: GENERATION_DIRECTIONS[0].label, output_mode: "artwork",
    prompt_version: "inkstory-generation-v2", model: "gpt-image-2.5-flare",
    size: "1024x1536", quality: "high",
    prompt: "PRIVATE PROMPT", detail: "PRIVATE NOTES",
    image_url: "https://private.example/storage/image.png", raw_path: "owner/brief/image.png",
  });
  assert.deepEqual(safe, {
    variant: "Focused symbol", output_mode: "artwork",
    prompt_version: "inkstory-generation-v2", model: "gpt-image-2.5-flare",
    size: "1024x1536", quality: "high",
  });
  for (const value of [null, [], true, "metadata"]) assert.deepEqual(sanitiseConceptMeta(value), {});
  assert.deepEqual(sanitiseConceptMeta({
    variant: "Private notes", output_mode: "unknown",
    prompt_version: "a".repeat(65), model: "owner/brief/private.png",
    size: "99999x99999", quality: { name: "high" },
  }), {});
  assert.deepEqual(sanitiseConceptMeta({ model: "a".repeat(81), prompt_version: "https://example.test", variant: "x".repeat(1000) }), {});
  assert.equal(sanitiseConceptMeta({ variant: "Considered & minimal", size: "1024x1024", quality: "low" }).variant, "Considered & minimal");
});

test("saved output labels never infer a mode or direction for legacy metadata", () => {
  assert.equal(savedOutputLabel({ output_mode: "artwork" }), "Artwork only");
  assert.equal(savedOutputLabel({ output_mode: "on_body" }), "On-body mockup");
  assert.equal(savedOutputLabel(null), "Legacy image · output format not recorded");
  assert.equal(savedOutputLabel({ quality: "low" }), "Legacy image · output format not recorded");
  assert.equal(savedDirectionLabel(null), "Saved direction not recorded");
  assert.equal(savedDirectionLabel({ variant: "Considered & minimal" }), "Considered & minimal");
});

test("server rows and API results are reduced to private route URLs and safe metadata", () => {
  for (const image_url of ["owner/brief/private.png", "https://example.test/private.png", "data:image/png;base64,secret"]) {
    const concept = privateConcept({ id: ID, idx: 1, image_url, meta: { prompt: "NEVER EXPOSE" }, prompt: "NEVER EXPOSE", created_at: "2026-09-12T10:00:00Z" });
    assert.ok(concept);
    assert.equal(concept.image_url, `/api/concept-image/${ID}`);
    assert.equal(concept.created_at, "2026-09-12T10:00:00Z");
    assert.doesNotMatch(JSON.stringify(concept), /NEVER EXPOSE|data:image|example.test|owner\/brief/);
  }
  assert.equal(privateConcept({ id: ID, idx: 0, image_url: null })?.image_url, null);
  for (const invalid of [
    { id: "https://example.test/image", idx: 0 }, { id: "../private", idx: 0 },
    { id: ID, idx: "0" }, { id: ID, idx: 3 }, { id: ID, idx: -1 }, { id: ID, idx: 0.5 }, null,
  ]) assert.equal(privateConcept(invalid), null);
});

test("real empty grid renders two radios, three honest directions and no fake output or request", (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("No outbound request allowed"); });
  const html = renderToStaticMarkup(React.createElement(ConceptsGrid, { briefId: ID, initialConcepts: [], brief, previewOnly: true }));
  assert.equal((html.match(/type="radio"/g) || []).length, 2);
  const selectedRadio = html.match(/<input[^>]*value="on_body"[^>]*>/)?.[0] ?? "";
  assert.match(selectedRadio, /checked=""/);
  assert.match(html, /value="artwork"/);
  for (const direction of GENERATION_DIRECTIONS) assert.ok(html.includes(direction.label));
  assert.equal((html.match(/data-testid="button-review-/g) || []).length, 3);
  assert.match(html, /2:3 portrait/);
  assert.match(html, /high quality requested/);
  assert.match(html, /Selected palette: Black and grey/);
  assert.match(html, /not a generated preview/);
  assert.doesNotMatch(html, /<img|<dialog|<progress|inkstory-print-brief|Save as PDF|PRIVATE PROMPT/);
  assert.equal(calls, 0);
});

test("review renders intended shared settings and disclosures, but never raw prompt text", (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Rendering cannot send a request"); });
  const request = { index: 2, outputMode: "artwork" as const, replacement: true };
  const plan = buildGenerationPlan(brief, request.index, request.outputMode);
  const html = renderToStaticMarkup(React.createElement(GenerationReview, {
    brief, request, previewOnly: false, onCancel() {}, onConfirm() {},
  }));
  assert.match(html, /aria-labelledby="generation-review-title"/);
  assert.match(html, /aria-describedby="generation-review-disclosure"/);
  for (const text of [plan.label, plan.outputLabel, plan.model, plan.quality]) assert.ok(html.includes(text));
  assert.match(html, /sent to OpenAI when you confirm/);
  assert.match(html, /1 allowance, even if it fails/);
  assert.match(html, /new composition, not a precise edit/);
  assert.match(html, /existing image stays until a new image is saved successfully/);
  assert.match(html, /several minutes/);
  assert.match(html, /no automatic retry/);
  assert.match(html, /not promised to match the editorial gallery/);
  assert.match(html, /Confirm &amp; request one replacement/);
  assert.match(html, /Review the saved brief being sent/);
  assert.match(html, /Oak tree; roots; crescent moon/);
  assert.match(html, /Avoid: lettering, birds, red ink/);
  assert.doesNotMatch(html, /POLICY AND DATA BOUNDARY|SAVED BRIEF DATA|END SAVED BRIEF DATA/);
});

test("saved image uses portrait contain, private image route and image-owned labels", () => {
  const html = renderToStaticMarkup(React.createElement(ConceptImage, {
    conceptId: ID, index: 0, meta: { output_mode: "artwork", variant: "Considered & minimal", quality: "low", size: "1024x1024" },
  }));
  assert.match(html, new RegExp(`src="/api/concept-image/${ID}"`));
  assert.match(html, /aspect-\[2\/3\]/);
  assert.match(html, /object-contain/);
  assert.match(html, /Artwork only/);
  assert.match(html, /Considered &amp; minimal/);
  assert.match(html, /low quality/);
  assert.match(html, /AI concept mockup/);
  assert.match(html, /View full-size image 1/);
  assert.doesNotMatch(html, /object-cover|On-body mockup|https:\/\//);
  const legacy = renderToStaticMarkup(React.createElement(GenerationMetadata, { meta: null }));
  assert.match(legacy, /Legacy image · output format not recorded/);
});

test("only explicit confirmation reaches one bounded API call, and preview returns first", () => {
  const grid = source("src/app/concepts/[id]/ConceptsGrid.tsx");
  assert.equal((grid.match(/fetch\(/g) || []).length, 1);
  assert.match(grid, /if \(!review\) return/);
  assert.match(grid, /if \(lock\.current\) return/);
  assert.match(grid, /body: JSON\.stringify\(\{ brief_id: briefId, idx: index, output_mode: requestedMode \}\)/);
  assert.doesNotMatch(grid, /useEffect|setInterval|setTimeout|Promise\.all|AbortController/);
  const confirm = grid.slice(grid.indexOf("async function confirmRequest"));
  assert.ok(confirm.indexOf("if (previewOnly)") < confirm.indexOf('fetch("/api/generate-one"'));
  assert.match(confirm, /if \(previewOnly\) \{[\s\S]*?Isolated preview: no request sent[\s\S]*?return;/);
  assert.match(grid, /onChange=\{\(\) => setOutputMode\(mode\.id\)\}/);
  assert.match(grid, /onCancel=\{\(\) => setReview\(null\)\}/);
  assert.match(grid, /onClick=\{\(\) => openReview\(index\)\}/);
  assert.match(grid, /setSlots\([\s\S]*?slotIndex === index \? concept : slot/);
  const failure = grid.split("} catch (cause)")[1].split("} finally")[0];
  assert.doesNotMatch(failure, /setSlots|fetch\(/);
  assert.doesNotMatch(grid, /<progress|aria-valuenow|progress.*%/);
});

test("owner page selects newest canonical row per slot and still enforces ownership", () => {
  const page = source("src/app/concepts/[id]/page.tsx");
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /if \(!user\) redirect/);
  assert.match(page, /\.eq\("brief_id", id\)\.eq\("user_id", user\.id\)/);
  assert.match(page, /select\("id,idx,image_url,meta,created_at"\)/);
  assert.match(page, /\.order\("created_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.match(page, /if \(concept && !canonical\.has\(concept\.idx\)\) canonical\.set/);
  assert.match(page, /privateConcept\(row\)/);
});

test("saved brief opens review directly; existing save, validation and ownership remain", () => {
  const wizard = source("src/app/brief/BriefWizard.tsx");
  assert.match(wizard, /const id = await save\(trimmedBrief\(brief\)\)/);
  assert.match(wizard, /router\.push\(`\/concepts\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(wizard, /validateBrief\(brief, step\)/);
  assert.match(wizard, /\.eq\("user_id", user\.id\)/);
  assert.match(wizard, /Save & open generation review/);
  assert.doesNotMatch(wizard, /fetch\(|\/api\/generate|generationStatus/);
  const fields = source("src/components/BriefFields.tsx");
  assert.match(fields, /dominant motif first/);
  assert.match(fields, /at most two supporting motifs/);
  assert.match(fields, /exact avoid list/);
});

test("native image/review dialog traps tab and cleans up focus and body scrolling", () => {
  const dialog = source("src/app/concepts/[id]/GenerationDialog.tsx");
  assert.match(dialog, /dialog\.showModal\(\)/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(dialog, /return \(\) => \{[\s\S]*dialog\.close\(\)/);
  assert.match(dialog, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(dialog, /opener\?\.isConnected/);
  assert.match(dialog, /opener\.focus\(\{ preventScroll: true \}\)/);
  assert.match(dialog, /onCancel=\{\(event\) => \{ event\.preventDefault\(\); onClose\(\); \}\}/);
  assert.match(dialog, /onKeyDown=\{containTab\}/);
  assert.match(dialog, /control\.getClientRects\(\)\.length > 0/);
  const image = source("src/app/concepts/[id]/ConceptImage.tsx");
  assert.match(image, /credentials: "same-origin", cache: "no-store"/);
  assert.match(image, /if \(previewOnly\) \{[\s\S]*?return;/);
  assert.match(image, /URL\.revokeObjectURL\(url\)/);
  assert.doesNotMatch(image, /object-cover|image_url|supabase|storage\/v1/);
});

test("isolated generation demonstration is preview-only, discoverable and has no fixture images", () => {
  const main = source("preview/main.tsx");
  assert.match(main, /path === "\/demo\/generation-review"/);
  assert.match(main, /href="\/demo\/generation-review"/);
  const demo = source("preview/GenerationReviewDemo.tsx");
  assert.match(demo, /<ConceptsGrid[\s\S]*?initialConcepts=\{\[\]\}[\s\S]*?previewOnly/);
  assert.match(demo, /fictional brief/);
  assert.doesNotMatch(demo, /fetch\(|localStorage|sessionStorage|\/gallery\/|image_url|<img/);
});
