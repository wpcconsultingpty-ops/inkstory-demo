"use client";

import type { BriefDraft } from "@/lib/brief";
import { buildGenerationPlan } from "@/lib/generation-plan";
import { BriefSummary } from "@/components/BriefFields";
import GenerationDialog from "./GenerationDialog";
import GenerationIntent from "./GenerationIntent";

export type ReviewRequest = { index: number; replacement: boolean };

export default function GenerationReview({ brief, request, previewOnly, onCancel, onConfirm }: {
  brief: BriefDraft;
  request: ReviewRequest;
  previewOnly: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const plan = buildGenerationPlan(brief, request.index);
  return (
    <GenerationDialog titleId="generation-review-title" descriptionId="generation-review-disclosure" onClose={onCancel}>
      <div className="gallery-dialog-toolbar">
        <p className="text-sm text-accent-soft">Review one request</p>
        <button type="button" className="btn-ghost" data-dialog-focus onClick={onCancel} data-testid="button-cancel-review">Cancel</button>
      </div>
      <div className="p-6">
        <p className="text-xs text-accent">Direction {request.index + 1} · {request.replacement ? "New composition to replace this image" : "New image"}</p>
        <h2 id="generation-review-title" className="mt-2 text-xl font-medium">{plan.label}</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div><dt className="text-ink-muted">Composition intent</dt><dd className="mt-1">{plan.description}</dd></div>
          <div><dt className="text-ink-muted">Output</dt><dd className="mt-1">{plan.outputLabel} · 2:3 portrait · {plan.size.replace("x", " × ")}</dd></div>
          <div><dt className="text-ink-muted">Required body placement from your saved brief</dt><dd className="mt-1 whitespace-pre-wrap break-words font-medium text-accent-soft" data-testid="review-body-placement">{brief.placement || "Placement not recorded"}</dd></div>
          <div><dt className="text-ink-muted">Presentation target</dt><dd className="mt-1">Gallery-style on-body rendering: realistic skin, crisp tattoo detail, soft side-light and a charcoal background. Your selected tattoo style and palette stay unchanged.</dd></div>
          <div><dt className="text-ink-muted">Requested generation settings</dt><dd className="mt-1">{plan.quality} quality · {plan.model}</dd></div>
        </dl>
        <div className="mt-5">
          <GenerationIntent brief={brief} styleNote={plan.styleNote} placementNote={plan.placementNote} />
        </div>
        <details className="mt-3 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 text-accent-soft">Review the saved brief being sent</summary>
          <div className="mt-3 rounded-xl border border-ink-ring p-4">
            <BriefSummary brief={brief} />
          </div>
        </details>
        <div id="generation-review-disclosure" className="mt-6 space-y-3 border-t border-ink-ring pt-5 text-sm">
          <p>Your saved brief, including story, motifs and notes, is sent to OpenAI when you confirm. Do not include sensitive personal information.</p>
          <p><strong className="font-medium text-accent-soft">One image request may use 1 allowance, even if it fails</strong> after generation is reserved. Access and allowance are checked when you confirm.</p>
          <p>{request.replacement ? "This replacement is a new composition, not a precise edit. Your existing image stays until a new image is saved successfully." : "Any later replacement is a new composition, not a precise edit. An existing image stays until its replacement is saved successfully."}</p>
          <p>High-quality requests may take several minutes. Keep this page open; there is no automatic retry.</p>
          <p>All directions request this same placement on a fictional adult or a safe anatomical body form, never standalone artwork. Check the result: placement instructions are not visual validation.</p>
          <p className="text-ink-muted">AI concept mockup only. An artist must review placement, scale, detail and tattooability. Results can vary and are not promised to match the editorial gallery.</p>
        </div>
        {previewOnly && <p className="mt-5 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-accent-soft">Isolated preview: confirmation will not send your brief, make a request or use an allowance.</p>}
        <button type="button" className="btn-primary mt-6 w-full" onClick={onConfirm} data-testid="button-confirm-generation">
          {previewOnly ? "Confirm in isolated preview" : request.replacement ? "Confirm & request one replacement" : "Confirm & request one image"}
        </button>
      </div>
    </GenerationDialog>
  );
}
