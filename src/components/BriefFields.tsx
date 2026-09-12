"use client";

import { useEffect, useRef } from "react";
import { PALETTES, PLACEMENTS, SIZES, STYLES, type BriefDraft } from "@/lib/brief";
import { BRIEF_FIELDS, BRIEF_LABELS, STEP_LABELS, characterCount, type BriefErrors } from "./brief-validation";

export function BriefSummary({ brief }: { brief: Partial<Record<keyof BriefDraft, string | null>> }) {
  return (
    <dl className="space-y-4 text-sm">
      {BRIEF_FIELDS.map((key) => (
        <div key={key} className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-ink-muted">{BRIEF_LABELS[key]}</dt>
          <dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{brief[key]?.trim() || "Not provided"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BriefProgress({ step }: { step: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!first.current) heading.current?.focus();
    first.current = false;
  }, [step]);
  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">Step {step + 1} of {STEP_LABELS.length}</p>
      <ol className="mb-6 flex gap-2" aria-label="Brief progress">
        {STEP_LABELS.map((label, index) => (
          <li key={label} className="flex-1" aria-current={index === step ? "step" : undefined}>
            <span className={`block h-1 rounded-full ${index <= step ? "bg-accent" : "bg-ink-ring"}`} aria-hidden="true" />
            <span className="sr-only">{label}{index < step ? " — completed" : ""}</span>
          </li>
        ))}
      </ol>
      <h1 ref={heading} tabIndex={-1} className="font-display text-3xl">{STEP_LABELS[step]}</h1>
    </>
  );
}

export function ValidationSummary({ errors }: { errors: BriefErrors }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasErrors = Object.keys(errors).length > 0;
  useEffect(() => { if (hasErrors) ref.current?.focus(); }, [errors, hasErrors]);
  if (!hasErrors) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="mt-6 rounded-xl border border-red-400/40 bg-red-400/5 p-4 text-sm text-red-200">
      <p className="font-medium">Please check your brief before continuing.</p>
      <ul className="mt-2 list-inside list-disc space-y-1">{Object.entries(errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul>
    </div>
  );
}

export default function BriefFields({ step, brief, errors, onChange, disabled = false }: {
  step: number;
  brief: BriefDraft;
  errors: BriefErrors;
  onChange: (key: keyof BriefDraft, value: string) => void;
  disabled?: boolean;
}) {
  function fieldError(key: keyof BriefDraft) {
    return errors[key] ? <p id={`${key}-error`} className="text-sm text-red-200">{errors[key]}</p> : null;
  }
  function choice(key: keyof BriefDraft, options: string[]) {
    return (
      <fieldset className="space-y-3" disabled={disabled} aria-describedby={errors[key] ? `${key}-error` : undefined}>
        <legend className="mb-3 text-sm font-medium">{BRIEF_LABELS[key]} <span className="text-ink-muted">(required)</span></legend>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <label key={option} className={`chip relative ${brief[key] === option ? "chip-active" : ""}`}>
              <input
                className="absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
                type="radio"
                name={key}
                value={option}
                checked={brief[key] === option}
                onChange={() => onChange(key, option)}
                required
                aria-invalid={!!errors[key]}
              />
              {option}
            </label>
          ))}
        </div>
        {brief[key] && !options.includes(brief[key]) && <p className="break-words text-sm text-ink-muted">Previously saved: {brief[key]}. Choose an option to change it.</p>}
        {fieldError(key)}
      </fieldset>
    );
  }
  return (
    <div className="mt-6 space-y-6">
      {step === 0 && (
        <div className="space-y-3">
          <label htmlFor="meaning" className="block text-sm font-medium">Meaning & story (required)</label>
          <p id="meaning-help" className="text-sm text-ink-muted">What do you want this piece to represent? Use 10–2,000 characters. Keep it general: do not include sensitive personal details, medical information or other people’s private stories.</p>
          <textarea id="meaning" className="textarea" value={brief.meaning} onChange={(event) => onChange("meaning", event.target.value)} placeholder="e.g. A reminder of the places I have explored and the freedom of being outdoors." required minLength={10} maxLength={2000} disabled={disabled} aria-invalid={!!errors.meaning} aria-describedby={`meaning-help${errors.meaning ? " meaning-error" : ""}`} />
          <p className="text-xs text-ink-muted">{characterCount(brief.meaning).toLocaleString()} / 2,000 characters</p>
          {fieldError("meaning")}
        </div>
      )}
      {step === 1 && <>{choice("placement", PLACEMENTS)}{choice("size_cm", SIZES)}</>}
      {step === 2 && <>{choice("style", STYLES)}{choice("palette", PALETTES)}</>}
      {step === 3 && (
        <>
          <div className="space-y-3">
            <label htmlFor="key_elements" className="block text-sm font-medium">Key elements (required)</label>
            <p id="elements-help" className="text-sm text-ink-muted">List the motifs you want to discuss. If undecided, say “open to artist suggestions”. Maximum 2,000 characters.</p>
            <textarea id="key_elements" className="textarea" required maxLength={2000} value={brief.key_elements} onChange={(event) => onChange("key_elements", event.target.value)} placeholder="e.g. mountain outline, winding trail, small sun" disabled={disabled} aria-invalid={!!errors.key_elements} aria-describedby={`elements-help${errors.key_elements ? " key_elements-error" : ""}`} />
            {fieldError("key_elements")}
          </div>
          <div className="space-y-3">
            <label htmlFor="reference_notes" className="block text-sm font-medium">References & notes (optional)</label>
            <p id="notes-help" className="text-sm text-ink-muted">Describe references, details to avoid and questions for your artist. No uploads here. Maximum 2,000 characters.</p>
            <textarea id="reference_notes" className="textarea" maxLength={2000} value={brief.reference_notes} onChange={(event) => onChange("reference_notes", event.target.value)} placeholder="e.g. Leave room for future additions; ask about line weight and ageing." disabled={disabled} aria-invalid={!!errors.reference_notes} aria-describedby={`notes-help${errors.reference_notes ? " reference_notes-error" : ""}`} />
            {fieldError("reference_notes")}
          </div>
        </>
      )}
      {step === 4 && <div className="card"><BriefSummary brief={brief} /></div>}
      <p className="text-xs text-ink-muted">Whole brief: {BRIEF_FIELDS.reduce((sum, key) => sum + characterCount(brief[key].trim()), 0).toLocaleString()} / 6,000 characters.</p>
    </div>
  );
}
