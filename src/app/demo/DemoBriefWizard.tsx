"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { BriefDraft } from "@/lib/brief";
import { createDemoBrief, getDemoBrief, updateDemoBrief } from "@/lib/demo";
import BriefFields, { BriefProgress, ValidationSummary } from "@/components/BriefFields";
import { draftFrom, firstErrorStep, trimmedBrief, validateBrief, type BriefErrors } from "@/components/brief-validation";
import DemoStorageNotice from "@/components/DemoStorageNotice";
import ExportBrief from "@/components/ExportBrief";
import { PilotLinks } from "@/components/PilotLinks";

export default function DemoBriefWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const initialId = params.get("id");
  const idRef = useRef<string | null>(null);
  const busy = useRef(false);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<BriefDraft>(() => draftFrom());
  const [errors, setErrors] = useState<BriefErrors>({});
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const existing = initialId ? getDemoBrief(initialId) : null;
    idRef.current = existing?.id ?? null;
    setBrief(draftFrom(existing));
    setMissing(!!initialId && !existing);
    setStep(0);
    setDirty(false);
    setReady(true);
  }, [initialId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(key: keyof BriefDraft, value: string) {
    setBrief((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaveError("");
    setErrors({});
  }

  function next() {
    if (busy.current) return;
    const found = validateBrief(brief, step);
    setErrors(found);
    if (Object.keys(found).length) {
      if (step === 4) {
        const first = firstErrorStep(found);
        if (first >= 0) setStep(first);
      }
      return;
    }
    busy.current = true;
    try {
      const draft = trimmedBrief(brief);
      if (!idRef.current) idRef.current = createDemoBrief(draft).id;
      const saved = updateDemoBrief(idRef.current, { ...draft, status: step === 4 ? "reviewed" : "draft" });
      if (!saved) throw new Error("Missing brief");
      setBrief(draft);
      setDirty(false);
      setRevision((value) => value + 1);
      if (step === 4) router.push(`/demo/concepts/${encodeURIComponent(idRef.current)}`);
      else setStep((value) => value + 1);
    } catch {
      setSaveError("We could not keep this draft. Your text is still on this page. Export a copy before starting a new brief.");
    } finally {
      busy.current = false;
    }
  }

  if (!ready) return <main className="mx-auto max-w-3xl px-6 py-10"><p role="status">Opening local brief…</p></main>;
  if (missing) return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Local brief not found</h1>
      <p className="mt-3 text-ink-muted">It may have been cleared or kept only in memory in another preview. Local briefs are not restored from an account.</p>
      <Link href="/demo/brief" className="btn-primary mt-6">Start a new local brief</Link>
      <PilotLinks />
    </main>
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/demo/dashboard" className="py-3 text-sm text-ink-muted hover:text-white">← Local briefs</Link>
        <span className="pill">Local layout demo · No AI generation</span>
      </header>
      <BriefProgress step={step} />
      <DemoStorageNotice revision={revision} unsaved={dirty} />
      <form noValidate onSubmit={(event) => { event.preventDefault(); next(); }}>
        <ValidationSummary errors={errors} />
        <BriefFields step={step} brief={brief} errors={errors} onChange={change} />
        {step === 4 && <p className="mt-4 text-sm text-ink-muted">Next, compare three fixed abstract layouts alongside your captured brief. They are the same examples for everyone, not personalised tattoo designs. No story is sent for AI generation.</p>}
        {saveError && <p role="alert" className="mt-4 text-sm text-red-200">{saveError}</p>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => { setStep((value) => Math.max(0, value - 1)); setErrors({}); }}>Back</button>
          <button className="btn-primary" type="submit">{step === 4 ? "View example layouts" : "Save locally & continue"}</button>
        </div>
      </form>
      {step === 4 && <ExportBrief brief={brief} mode="demo" />}
      <PilotLinks />
    </main>
  );
}
