"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { STYLES, PLACEMENTS, SIZES, PALETTES } from "@/lib/brief";
import {
  activateDemo,
  createDemoBrief,
  generateDemoConcepts,
  getDemoBrief,
  updateDemoBrief,
  type DemoBrief
} from "@/lib/demo";

export default function DemoBriefWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const initialId = params.get("id");

  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [brief, setBrief] = useState({
    meaning: "",
    placement: "",
    size_cm: "",
    style: "",
    key_elements: "",
    palette: "",
    reference_notes: ""
  });

  // Bootstrap: activate demo mode, load existing brief or create a fresh one.
  useEffect(() => {
    activateDemo();
    let existing: DemoBrief | null = initialId ? getDemoBrief(initialId) : null;
    if (!existing) existing = createDemoBrief();
    setBriefId(existing.id);
    setBrief({
      meaning: existing.meaning ?? "",
      placement: existing.placement ?? "",
      size_cm: existing.size_cm ?? "",
      style: existing.style ?? "",
      key_elements: existing.key_elements ?? "",
      palette: existing.palette ?? "",
      reference_notes: existing.reference_notes ?? ""
    });
    setReady(true);
  }, [initialId]);

  // Autosave to localStorage.
  useEffect(() => {
    if (!ready || !briefId) return;
    const t = setTimeout(() => {
      updateDemoBrief(briefId, brief);
    }, 400);
    return () => clearTimeout(t);
  }, [brief, briefId, ready]);

  function submitAndGenerate() {
    if (!briefId) return;
    setSaving(true);
    updateDemoBrief(briefId, brief);
    generateDemoConcepts(briefId);
    router.push(`/demo/concepts/${briefId}`);
  }

  const steps = [
    { key: "meaning", label: "Meaning" },
    { key: "placement", label: "Placement & size" },
    { key: "style", label: "Style" },
    { key: "key_elements", label: "Elements" },
    { key: "review", label: "Review" }
  ];

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-muted hover:text-white">← InkStory</Link>
        <div className="text-xs text-ink-muted">
          Demo mode · {saving ? "Saving…" : "Saved locally"}
        </div>
      </header>

      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-ink-ring"}`}
              aria-hidden
            />
          </div>
        ))}
      </div>
      <h1 className="font-display text-3xl">{steps[step].label}</h1>

      <div className="mt-6">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              What is this piece meant to carry? Think meaning, story, or the moment it marks.
            </p>
            <textarea
              className="textarea"
              placeholder="e.g. Marks the year I rebuilt my life after loss. The wolf represents the guide I found in myself."
              value={brief.meaning}
              onChange={(e) => setBrief({ ...brief, meaning: e.target.value })}
            />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-ink-muted">Where on the body?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PLACEMENTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip ${brief.placement === p ? "chip-active" : ""}`}
                    onClick={() => setBrief({ ...brief, placement: p })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-ink-muted">Approximate size</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${brief.size_cm === s ? "chip-active" : ""}`}
                    onClick={() => setBrief({ ...brief, size_cm: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-ink-muted">Style</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip ${brief.style === s ? "chip-active" : ""}`}
                    onClick={() => setBrief({ ...brief, style: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-ink-muted">Palette</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {PALETTES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip ${brief.palette === p ? "chip-active" : ""}`}
                    onClick={() => setBrief({ ...brief, palette: p })}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              Key elements that must appear (comma-separated). Anything you already know you want in the piece.
            </p>
            <input
              className="input"
              placeholder="e.g. wolf, runes, longship, mountains"
              value={brief.key_elements}
              onChange={(e) => setBrief({ ...brief, key_elements: e.target.value })}
            />
            <p className="mt-4 text-sm text-ink-muted">Any references, artist inspiration, or notes?</p>
            <textarea
              className="textarea"
              placeholder="e.g. Inspired by Kai Prusa's fine-line, but bolder. No colour."
              value={brief.reference_notes}
              onChange={(e) => setBrief({ ...brief, reference_notes: e.target.value })}
            />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <div className="card space-y-3">
              <Row k="Meaning" v={brief.meaning || "—"} />
              <Row k="Placement" v={brief.placement || "—"} />
              <Row k="Size" v={brief.size_cm || "—"} />
              <Row k="Style" v={brief.style || "—"} />
              <Row k="Palette" v={brief.palette || "—"} />
              <Row k="Elements" v={brief.key_elements || "—"} />
              <Row k="Notes" v={brief.reference_notes || "—"} />
            </div>
            <p className="text-sm text-ink-muted">
              Demo mode: three concept directions will be generated instantly from your brief and shown on the next screen.
            </p>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <button
          className="btn-ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button className="btn-primary" onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn-primary" onClick={submitAndGenerate} disabled={saving}>
            {saving ? "Working…" : "Generate concepts"}
          </button>
        )}
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-6 text-sm">
      <span className="text-ink-muted">{k}</span>
      <span className="max-w-[70%] text-right text-white">{v}</span>
    </div>
  );
}
