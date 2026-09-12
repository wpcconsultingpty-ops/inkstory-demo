import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBrief as validateUI, draftFrom, firstErrorStep } from "../src/components/brief-validation";
import { validateBrief as validateAPI, BRIEF_LIMITS } from "../src/lib/security";
import type { BriefDraft } from "../src/lib/brief";

const valid: BriefDraft = {
  meaning: "A reminder of resilience and courage.",
  placement: "Inner forearm", size_cm: "Medium", style: "Illustrative",
  palette: "Black and grey", key_elements: "An oak leaf", reference_notes: ""
};

test("UI and API agree on every field boundary", () => {
  for (const [key, limit] of Object.entries(BRIEF_LIMITS)) {
    const at = { ...valid, [key]: "a".repeat(limit) };
    assert.deepEqual(validateUI(at), {});
    assert.doesNotThrow(() => validateAPI(at));
    const over = { ...valid, [key]: "a".repeat(limit + 1) };
    assert.ok(validateUI(over)[key as keyof BriefDraft]);
    assert.throws(() => validateAPI(over));
  }
});

test("UI validates missing fields, control characters and total size", () => {
  assert.equal(firstErrorStep(validateUI(draftFrom())), 0);
  assert.ok(validateUI({ ...valid, key_elements: "" }).key_elements);
  assert.ok(validateUI({ ...valid, reference_notes: "\u0001" }).reference_notes);
  assert.ok(validateUI({ ...valid, meaning: "a".repeat(2000), key_elements: "b".repeat(2000), reference_notes: "c".repeat(2000) }).total);
});

test("UI and API count Unicode code points consistently", () => {
  const brief = { ...valid, meaning: "😀".repeat(2000), reference_notes: "café 日本語" };
  assert.deepEqual(validateUI(brief), {});
  assert.doesNotThrow(() => validateAPI(brief));
});
