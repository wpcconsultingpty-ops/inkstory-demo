"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emptyBrief, BriefDraft, STYLES, PLACEMENTS, SIZES, PALETTES } from "@/lib/brief";

type Props = { initial: any | null; userEmail: string };

export default function BriefWizard({ initial, userEmail }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [briefId, setBriefId] = useState<string | null>(initial?.id ?? null);
  const [brief, setBrief] = useState<BriefDraft>({
    meaning: initial?.meaning ?? "",
    placement: initial?.placement ?? "",
    size_cm: initial?.size_cm ?? "",
    style: initial?.style ?? "",
    key_elements: initial?.key_elements ?? "",
    palette: initial?.palette ?? "",
    reference_notes: initial?.reference_notes ?? ""
  });

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // autosave on change
  useEffect(() => {
    const t = setTimeout(() => save(false), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief]);

  async function save(showState = true) {
    if (showState) setSaving(true);
    const payload = { ...brief, brief: brief, status: "draft" as const };
    if (briefId) {
      await supabase.from("briefs").update(payload).eq("id", briefId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("briefs")
        .insert({ ...payload, user_id: user.id })
        .select("id")
        .single();
      if (data?.id) setBriefId(data.id);
    }
    if (showState) setSaving(false);
  }

  async function submitAndGenerate() {
    setSaving(true);
    await save(false);
    // Mark submitted, request generation
    if (briefId) {
      await supabase.from("briefs").update({ status: "submitted" }).eq("id", briefId);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief_id: briefId })
      });
      if (res.ok) {
        router.push(`/concepts/${briefId}`);
        return;
      }
    }
    setSaving(false);
  }

  const steps = [
    { key: "meaning", label: "Meaning" },
    { key: "placement", label: "Placement & size" },
    { key: "style", label: "Style" },
    { key: "key_elements", label: "Elements" },
    { key: "review", label: "Review" }
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-muted hover:text-white">← InkStory</Link>
        <div className="text-xs text-ink-muted">
          {userEmail} · {saving ? "Saving…" : "Saved"}
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
              Ready when you are. This will generate three concept directions from your brief. It usually takes 20–40 seconds.
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
