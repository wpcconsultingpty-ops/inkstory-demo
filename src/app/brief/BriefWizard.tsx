"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BriefDraft } from "@/lib/brief";
import BriefFields, { BriefProgress, ValidationSummary } from "@/components/BriefFields";
import { draftFrom, firstErrorStep, trimmedBrief, validateBrief, type BriefErrors } from "@/components/brief-validation";
import { generationError } from "@/components/pilot-client";
import { EarlyAccessLink, PilotLinks } from "@/components/PilotLinks";
import ExportBrief from "@/components/ExportBrief";

type Props = { initial: (Partial<BriefDraft> & { id: string }) | null; userEmail: string };

export default function BriefWizard({ initial, userEmail }: Props) {
  const router = useRouter();
  // A stable ID is reused after response loss. A ref + single lock avoid closure races.
  const idRef = useRef<string | null>(initial?.id ?? null);
  const lock = useRef(false);
  const [briefId, setBriefId] = useState(initial?.id ?? null);
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState<BriefDraft>(() => draftFrom(initial));
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<"new" | "dirty" | "saving" | "saved" | "error">(initial ? "saved" : "new");
  const [errors, setErrors] = useState<BriefErrors>({});
  const [error, setError] = useState("");
  const [generationStatus, setGenerationStatus] = useState<number | null>(null);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (saveState === "dirty" || saveState === "saving" || saveState === "error") { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  function change(key: keyof BriefDraft, value: string) {
    setBrief((current) => ({ ...current, [key]: value }));
    setSaveState("dirty");
    setErrors({});
    setError("");
    setGenerationStatus(null);
  }

  async function save(snapshot: BriefDraft): Promise<string> {
    setSaveState("saving");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your session could not be verified. Sign in again before saving. Your text is still on this page.");
      if (!idRef.current) idRef.current = crypto.randomUUID();
      const id = idRef.current;
      const payload = { ...snapshot, brief: snapshot, status: "draft" };
      // Do not upsert id/user_id: the pilot grants intentionally forbid updating
      // ownership columns. Checking a stable ID also recovers a lost insert response.
      const { data: existing, error: lookupError } = await supabase.from("briefs")
        .select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (lookupError) throw new Error("The brief could not be saved to your account. Your text is still here. Check your connection and try Save again, or export a copy.");
      const result = existing
        ? await supabase.from("briefs").update(payload).eq("id", id).eq("user_id", user.id).select("id").single()
        : await supabase.from("briefs").insert({ id, user_id: user.id, ...payload }).select("id").single();
      const { data, error: saveError } = result;
      if (saveError || !data?.id || data.id !== id) throw new Error("The brief could not be saved to your account. Your text is still here. Check your connection and try Save again, or export a copy.");
      setBriefId(id);
      setBrief(snapshot);
      setSaveState("saved");
      return id;
    } catch (cause) {
      setSaveState("error");
      throw cause;
    }
  }

  async function submit(openConcepts: boolean, advance: boolean) {
    if (lock.current) return;
    const found = validateBrief(brief, step);
    setErrors(found);
    if (Object.keys(found).length) {
      if (step === 4) {
        const first = firstErrorStep(found);
        if (first >= 0) setStep(first);
      }
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setGenerationStatus(null);
    let saved = false;
    try {
      const id = await save(trimmedBrief(brief));
      saved = true;
      if (openConcepts) {
        // Preparation is not image generation; images need explicit actions on the next page.
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief_id: id }),
        });
        if (!response.ok) {
          setGenerationStatus(response.status);
          setError(generationError(response.status));
          return;
        }
        router.push(`/concepts/${encodeURIComponent(id)}`);
        return;
      }
      if (advance) setStep((value) => Math.min(4, value + 1));
    } catch (cause) {
      setError(cause instanceof Error && (cause.message.startsWith("Your session") || cause.message.startsWith("The brief could not")) ? cause.message :
        saved
          ? "The pilot request could not be confirmed. Your brief is saved. Check your connection, then try again."
          : "We could not confirm the save or pilot request. Stay on this page and try again, or export a copy. No further navigation has occurred.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="py-3 text-sm text-ink-muted hover:text-white">← My briefs</Link>
        <p className="min-w-0 break-words text-sm text-ink-muted">{userEmail}</p>
      </header>
      <BriefProgress step={step} />
      <p role="status" className="mt-3 text-sm text-accent-soft">
        {saveState === "new" ? "Not saved yet. Save each step to keep it in your account." :
          saveState === "dirty" ? "Unsaved changes. Save before leaving this page." :
          saveState === "saving" ? "Saving to your account…" :
          saveState === "error" ? "Save not confirmed. Your edits are still on this page." : "Saved to your account."}
      </p>
      <p className="mt-2 text-sm text-ink-muted">Account briefs are stored with Supabase. Image generation sends your brief to OpenAI only when requested and available to your invited account. Avoid sensitive details. <Link href="/privacy" className="text-accent underline">Read about data handling</Link>.</p>
      <form noValidate onSubmit={(event) => { event.preventDefault(); void submit(step === 4, step < 4); }}>
        <ValidationSummary errors={errors} />
        <BriefFields step={step} brief={brief} errors={errors} onChange={change} disabled={busy} />
        {step === 4 && <p className="mt-4 text-sm text-ink-muted">The account pilot is invitation-only and quota-limited. Opening concepts checks access; each image needs a separate generation request on the next page. You can save or export your brief without image access.</p>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/40 p-4 text-sm text-red-200">
          <p>{error}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/auth/login?next=${encodeURIComponent(briefId ? `/brief?id=${briefId}` : "/brief")}`} className="underline">Sign in again</Link>
            {(generationStatus === 403 || generationStatus === 429 || generationStatus === 503) && <EarlyAccessLink className="underline" />}
          </div>
        </div>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-ghost" type="button" disabled={step === 0 || busy} onClick={() => { setStep((value) => Math.max(0, value - 1)); setErrors({}); }}>Back</button>
          <div className="flex flex-wrap gap-3">
            {step === 4 && <button className="btn-ghost" type="button" disabled={busy} onClick={() => void submit(false, false)}>Save brief only</button>}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Working…" : step === 4 ? "Save & open pilot concepts" : "Save & continue"}</button>
          </div>
        </div>
      </form>
      {(step === 4 || !!error) && <ExportBrief brief={brief} mode="account" />}
      <PilotLinks />
    </main>
  );
}
