"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ConceptImage from "@/app/concepts/[id]/ConceptImage";
import {
  generateDemoConcepts,
  generateDemoImageOne,
  getDemoBrief,
  getDemoConcepts,
  markDemoBriefPurchased,
  type DemoBrief,
  type DemoConcept
} from "@/lib/demo";

export default function DemoConceptsView({ briefId }: { briefId: string }) {
  const [ready, setReady] = useState(false);
  const [brief, setBrief] = useState<DemoBrief | null>(null);
  const [concepts, setConcepts] = useState<DemoConcept[]>([]);
  const [busy, setBusy] = useState(false);
  const [imageStatus, setImageStatus] = useState<"idle" | "generating" | "ready" | "unavailable">("idle");

  function refresh() {
    setBrief(getDemoBrief(briefId));
    setConcepts(getDemoConcepts(briefId));
  }

  async function fetchRealImages() {
    setImageStatus("generating");
    // Fire all 3 in parallel — each runs in its own function invocation so each
    // can spend the full 60s Vercel budget on a single high-quality image.
    const jobs = [0, 1, 2].map(async (i) => {
      const result = await generateDemoImageOne(briefId, i);
      // Refresh UI as each image lands so the user sees progressive reveal.
      refresh();
      return result;
    });
    const results = await Promise.all(jobs);
    const anySuccess = results.some((r) => r.ok);
    if (anySuccess) {
      refresh();
      setImageStatus("ready");
    } else {
      const rateLimited = results.find((r) => !r.ok && r.status === 429);
      setImageStatus(rateLimited ? "unavailable" : "unavailable");
    }
  }

  useEffect(() => {
    const b = getDemoBrief(briefId);
    if (b && getDemoConcepts(briefId).length === 0) {
      generateDemoConcepts(briefId);
    }
    refresh();
    setReady(true);

    // If concepts are still placeholders, fetch real images in the background.
    const current = getDemoConcepts(briefId);
    const anyPlaceholder = current.some((c) => c.meta?.placeholder);
    if (anyPlaceholder) fetchRealImages();
    else setImageStatus("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId]);

  if (!ready) return null;

  if (!brief) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl">Demo brief not found</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Demo briefs live in your browser only. Start a new one to try it again.
        </p>
        <Link href="/demo/brief" className="btn-primary mt-6 inline-block">Start demo brief</Link>
      </main>
    );
  }

  const paid = brief.status === "mock_paid";

  async function regenerate() {
    setBusy(true);
    generateDemoConcepts(briefId);
    refresh();
    await fetchRealImages();
    setBusy(false);
  }

  function unlock() {
    setBusy(true);
    markDemoBriefPurchased(briefId);
    refresh();
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/demo/dashboard" className="text-sm text-ink-muted hover:text-white">← Demo briefs</Link>
        <button className="btn-ghost" onClick={regenerate} disabled={busy}>
          {busy ? "Working…" : "Regenerate concepts"}
        </button>
      </header>

      <h1 className="font-display text-3xl">Three directions from your brief</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Preview them here — pick your favourite and unlock the Concept Pack for downloadable high-res files and the
        artist-ready PDF.
      </p>
      {imageStatus === "generating" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-accent">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Generating high-detail concepts — this takes about 40–60 seconds. Placeholders show what layout each direction takes.
        </p>
      )}
      {imageStatus === "unavailable" && (
        <p className="mt-3 text-sm text-red-400">
          Image generation is temporarily unavailable (the demo is rate-limited to 5 briefs per hour per browser). Sign in with your email to keep generating.
        </p>
      )}
      <p className="mt-1 text-xs text-ink-muted/70">
        Demo mode: nothing on this page is saved to your account. Clear your browser data to reset.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {concepts.map((c) => (
          <div key={c.id} className="card">
            <div className="pill">Direction {c.idx + 1}</div>
            <div className="mt-4 aspect-square overflow-hidden rounded-xl border border-ink-ring bg-ink-edge">
              <ConceptImage src={c.image_url} alt={`Direction ${c.idx + 1}`} paid={paid} index={c.idx} />
            </div>
            <p className="mt-3 text-xs text-ink-muted">{c.meta?.variant ?? c.prompt}</p>
          </div>
        ))}
      </div>

      {!paid && (
        <div className="card mt-10">
          <div className="pill border-accent/60 text-accent">Concept Pack — A$19</div>
          <h2 className="mt-3 font-display text-2xl">Take your concepts with you</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Preview is free. Unlock the pack to keep the artwork and take it to your artist.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink-muted">
            <li>Downloadable full-resolution concept images (watermark-free)</li>
            <li>Artist-ready PDF brief with placement and references</li>
            <li>Unlimited regenerations on this brief</li>
          </ul>
          <button className="btn-primary mt-4" onClick={unlock} disabled={busy}>
            {busy ? "Unlocking…" : "Unlock Concept Pack (mock)"}
          </button>
        </div>
      )}

      <div className="mt-10">
        <details className="card">
          <summary className="cursor-pointer font-display">Your brief</summary>
          <div className="mt-4 space-y-2 text-sm">
            <Row k="Meaning" v={brief.meaning} />
            <Row k="Placement" v={brief.placement} />
            <Row k="Size" v={brief.size_cm} />
            <Row k="Style" v={brief.style} />
            <Row k="Palette" v={brief.palette} />
            <Row k="Elements" v={brief.key_elements} />
            <Row k="Notes" v={brief.reference_notes} />
          </div>
        </details>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-ink-muted">{k}</span>
      <span className="max-w-[70%] text-right text-white">{v || "—"}</span>
    </div>
  );
}
