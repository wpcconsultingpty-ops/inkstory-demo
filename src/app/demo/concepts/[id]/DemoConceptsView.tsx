"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EXAMPLE_LAYOUTS, getDemoBrief, SAMPLE_BRIEF, updateDemoBrief, type DemoBrief } from "@/lib/demo";
import { BriefSummary } from "@/components/BriefFields";
import ExampleLayout from "@/components/ExampleLayout";
import ExportBrief from "@/components/ExportBrief";
import DemoStorageNotice from "@/components/DemoStorageNotice";
import { EarlyAccessLink, PilotLinks } from "@/components/PilotLinks";

export default function DemoConceptsView({ briefId }: { briefId: string }) {
  const sample = briefId === "sample";
  const [ready, setReady] = useState(sample);
  const [brief, setBrief] = useState<DemoBrief | null>(sample ? { ...SAMPLE_BRIEF } : null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setBrief(sample ? { ...SAMPLE_BRIEF } : getDemoBrief(briefId));
    setReady(true);
  }, [briefId, sample]);

  function chooseLayout(index: number) {
    if (!brief) return;
    const updated = { ...brief, preferred_layout: index };
    if (!sample) updateDemoBrief(briefId, { preferred_layout: index });
    setBrief(updated);
    setRevision((value) => value + 1);
  }

  if (!ready) return <main className="mx-auto max-w-5xl px-6 py-10"><p role="status">Opening local brief…</p></main>;
  if (!brief) return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Local brief not found</h1>
      <p className="mt-3 text-ink-muted">It may have been cleared or lost when a memory-only preview was refreshed. Start a new local brief or explore the sample.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/demo/brief" className="btn-primary">Start local brief</Link><Link href="/demo/sample" className="btn-ghost">Explore sample brief</Link></div>
      <PilotLinks />
    </main>
  );
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href={sample ? "/" : "/demo/dashboard"} className="py-3 text-sm text-ink-muted hover:text-white">{sample ? "← InkStory" : "← Local briefs"}</Link>
        <Link href={sample ? "/demo/brief" : `/demo/brief?id=${encodeURIComponent(brief.id)}`} className="btn-ghost">{sample ? "Write your own brief" : "Edit your brief"}</Link>
      </header>
      <span className="pill">{sample ? "Fictional sample brief" : "Your local brief"} · No AI generation</span>
      <h1 className="mt-4 font-display text-3xl">A brief for a better conversation.</h1>
      <p className="mt-3 max-w-3xl text-ink-muted">These three abstract diagrams demonstrate composition only. They are fixed examples, not personalised AI tattoo concepts and not artwork to tattoo. Use them to think about space, balance and flow with your artist.</p>
      {!sample && <DemoStorageNotice revision={revision} />}

      <fieldset className="mt-8">
        <legend className="text-sm font-medium">Choose a layout to discuss (optional)</legend>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          {EXAMPLE_LAYOUTS.map((layout, index) => (
            <label key={layout.label} className={`card block cursor-pointer p-5 ${brief.preferred_layout === index ? "border-accent" : ""}`}>
              <span className="pill">Example layout {index + 1}</span>
              <div className="mt-4 overflow-hidden rounded-xl border border-ink-ring"><ExampleLayout index={index} /></div>
              <span className="mt-4 flex items-center gap-3 font-medium">
                <input className="h-5 w-5 shrink-0 accent-accent" type="radio" name="preferred_layout" value={index} checked={brief.preferred_layout === index} onChange={() => chooseLayout(index)} />
                {layout.label}
              </span>
              <span className="mt-2 block text-sm text-ink-muted">{layout.description}</span>
              <span className="mt-3 block text-sm text-accent-soft">{layout.question}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {brief.preferred_layout !== null && <p className="mt-4 text-sm text-accent-soft" role="status">Layout to discuss: {EXAMPLE_LAYOUTS[brief.preferred_layout].label}. {sample ? "This choice lasts only while this sample is open." : "Included in your text-only export."}</p>}
      <section className="card mt-8" aria-labelledby="brief-title">
        <h2 id="brief-title" className="mb-6 font-display text-2xl">{sample ? "The sample brief" : "Your captured brief"}</h2>
        <BriefSummary brief={brief} />
      </section>
      <ExportBrief brief={brief} mode="demo" labels={EXAMPLE_LAYOUTS.map((layout, index) => `Example layout ${index + 1}: ${layout.label} — ${layout.description}`)} preferredLayout={brief.preferred_layout !== null ? EXAMPLE_LAYOUTS[brief.preferred_layout].label : null} />
      <section className="mt-10 border-t border-ink-ring pt-8">
        <h2 className="font-display text-2xl">Interested in the account pilot?</h2>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted">When public generation is enabled, verified email accounts get one lifetime image attempt across all briefs and directions. Failed or expired reserved attempts count; no retries, manual review only. Shared service limits apply. This local demo makes no image requests and takes no payments.</p>
        <div className="mt-5"><EarlyAccessLink /></div>
      </section>
      <PilotLinks />
    </main>
  );
}
