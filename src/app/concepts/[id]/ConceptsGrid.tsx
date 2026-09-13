"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { BriefDraft } from "@/lib/brief";
import { buildGenerationPlan, GENERATION_DIRECTIONS } from "@/lib/generation-plan";
import { generationError } from "@/components/pilot-client";
import { EarlyAccessLink } from "@/components/PilotLinks";
import ExportBrief from "@/components/ExportBrief";
import ConceptImage from "./ConceptImage";
import GenerationReview, { type ReviewRequest } from "./GenerationReview";
import GenerationIntent from "./GenerationIntent";
import { privateConcept, savedDirectionLabel, savedOutputLabel, type Concept } from "./GenerationMetadata";

export type { Concept } from "./GenerationMetadata";

export default function ConceptsGrid({ briefId, initialConcepts, brief, previewOnly = false }: {
  briefId: string;
  initialConcepts: Concept[];
  brief: BriefDraft;
  previewOnly?: boolean;
}) {
  const [slots, setSlots] = useState<(Concept | null)[]>(() => GENERATION_DIRECTIONS.map((_, index) => privateConcept(initialConcepts.find((concept) => concept.idx === index))));
  const [review, setReview] = useState<ReviewRequest | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [errors, setErrors] = useState<(string | null)[]>([null, null, null]);
  const [messages, setMessages] = useState<(string | null)[]>([null, null, null]);
  const [revisions, setRevisions] = useState([0, 0, 0]);
  const lock = useRef(false);
  const sharedPlan = buildGenerationPlan(brief, 0);

  function openReview(index: number) {
    if (lock.current || review) return;
    setReview({ index, replacement: !!slots[index]?.image_url });
  }

  // Only the review's explicit confirmation can reach this function.
  async function confirmRequest() {
    if (!review) return;
    if (lock.current) return;
    lock.current = true;
    const { index } = review;
    setReview(null);
    setErrors((current) => current.map((error, slot) => slot === index ? null : error));
    setMessages((current) => current.map((message, slot) => slot === index ? null : message));
    if (previewOnly) {
      setMessages((current) => current.map((message, slot) => slot === index ? "Isolated preview: no request sent" : message));
      lock.current = false;
      return;
    }
    setPending(index);
    try {
      const response = await fetch("/api/generate-one", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_id: briefId, idx: index, output_mode: "on_body" }),
      });
      if (!response.ok) throw new Error(generationError(response.status));
      const payload = await response.json();
      const concept = privateConcept(payload?.concept);
      if (!concept || concept.idx !== index || !concept.image_url) {
        throw new Error("The response did not confirm a saved image. Refresh to check before trying again; the request may still count towards your allowance.");
      }
      setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? concept : slot));
      setRevisions((current) => current.map((value, slot) => slot === index ? value + 1 : value));
      setMessages((current) => current.map((message, slot) => slot === index ? "New AI concept mockup saved. Review it with your artist." : message));
    } catch (cause) {
      const message = cause instanceof Error && cause.name === "Error" ? cause.message : "The generation request could not be confirmed. Check your connection and refresh for a saved result before retrying. A request may still count towards your allowance.";
      setErrors((current) => current.map((error, slot) => slot === index ? message : error));
    } finally {
      setPending(null);
      lock.current = false;
    }
  }
  return (
    <>
      <section className="card mt-8" aria-labelledby="generation-plan-title">
        <h2 id="generation-plan-title" className="text-xl font-medium">Plan your next image</h2>
        <p className="mt-2 text-sm text-ink-muted">Preview the intent, then review one request at a time. Opening this page or reviewing a direction does not generate an image or use an allowance.</p>
        <div className="mt-5 rounded-xl border border-ink-ring bg-ink-edge p-4" data-testid="fixed-output-panel">
          <p className="text-sm font-medium">New images: {sharedPlan.outputLabel} only</p>
          <dl className="mt-3">
            <dt className="text-sm text-ink-muted">Selected body placement from your saved brief</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-lg font-medium text-accent-soft" data-testid="selected-body-placement">{brief.placement || "Placement not recorded"}</dd>
          </dl>
          <p className="mt-3 text-sm text-ink-muted">All three directions request this same body area, including any specified side and orientation. To change placement, edit and save your brief.</p>
          <p className="mt-3 text-sm text-ink-muted" data-testid="gallery-presentation-target">Gallery-style presentation: realistic skin, detailed tattoo rendering, soft studio lighting and a dark background. Your story, tattoo style and palette remain your own.</p>
          <p className="mt-3 text-xs text-ink-muted">An anonymous fictional adult or a safe anatomical body form is used, not a photo of you or proof of fit. Existing saved images keep their original format and labels.</p>
        </div>
        <div className="mt-5 border-t border-ink-ring pt-5" data-testid="planned-image-settings">
          <GenerationIntent brief={brief} styleNote={sharedPlan.styleNote} placementNote={sharedPlan.placementNote} />
        </div>
        <p className="mt-4 text-xs text-accent-soft">{sharedPlan.outputLabel} · 2:3 portrait · {sharedPlan.size.replace("x", " × ")} · {sharedPlan.quality} quality requested</p>
        <p className="mt-2 text-xs text-ink-muted">High-quality requests may take several minutes. These are intentions, not a guarantee of exact motif placement, style fidelity or gallery-equivalent results.</p>
      </section>
      <div className="mt-8 grid items-start gap-5 md:grid-cols-3">
        {GENERATION_DIRECTIONS.map((direction, index) => {
          const concept = slots[index];
          const hasImage = !!concept?.image_url;
          return (
            <section key={index} className="card min-w-0 p-5" aria-labelledby={`direction-${index}`} data-testid={`card-generation-${index}`}>
              <span className="pill">Direction {index + 1}</span>
              <h2 id={`direction-${index}`} className="mt-3 text-lg font-medium">{direction.label}</h2>
              <p className="mt-2 text-sm text-ink-muted" data-testid={`composition-intent-${index}`}>{direction.description}</p>
              <button type="button" className="btn-ghost mt-4 w-full" onClick={() => openReview(index)} disabled={pending !== null} aria-haspopup="dialog" data-testid={`button-review-${index}`}>
                {pending === index ? "Requesting…" : hasImage ? `Review replacement ${index + 1}` : `Review image ${index + 1} request`}
              </button>
              {hasImage && concept ? <ConceptImage key={`${concept.id}-${revisions[index]}`} conceptId={concept.id} index={index} meta={concept.meta} previewOnly={previewOnly} /> : (
                <div className="mt-4 flex aspect-[2/3] flex-col items-center justify-center gap-3 rounded-xl border border-ink-ring bg-ink-edge p-5 text-center text-sm text-ink-muted">
                  <p className="text-accent-soft">{pending === index ? "Request in progress" : "No saved image yet"}</p>
                  <p>{pending === index ? "Creating a high-quality AI concept mockup can take several minutes. Keep this page open." : "This is a composition direction, not a generated preview. Review the request above when you are ready."}</p>
                </div>
              )}
              {pending === index && <p role="status" className="mt-3 text-sm text-accent-soft">One request is in progress. It may take several minutes. Do not submit it again.{hasImage ? " Your saved image remains here until a replacement is saved." : ""}</p>}
              {messages[index] && <p role="status" className="mt-3 text-sm text-accent-soft" data-testid={`status-generation-${index}`}>{messages[index]}</p>}
              {errors[index] && <div role="alert" className="mt-4 text-sm text-red-200">
                <p>{errors[index]}</p>
                <div className="mt-3 flex flex-col gap-3">
                  <Link className="underline" href={`/brief?id=${encodeURIComponent(briefId)}`}>Review your brief</Link>
                  <Link className="underline" href={`/auth/login?next=${encodeURIComponent(`/concepts/${briefId}`)}`}>Sign in again</Link>
                  <EarlyAccessLink className="underline" />
                </div>
              </div>}
            </section>
          );
        })}
      </div>
      <p className="mt-5 text-sm text-ink-muted">AI concept mockups are discussion references, not finished tattoos or stencils. Your artist must simplify, adapt and approve the design for real skin. No result is promised to match the editorial gallery.</p>
      {review && <GenerationReview brief={brief} request={review} previewOnly={previewOnly} onCancel={() => setReview(null)} onConfirm={() => void confirmRequest()} />}
      {!previewOnly && <ExportBrief brief={brief} mode="account" labels={slots.flatMap((concept, index) => concept?.image_url ? [`Direction ${index + 1}: ${savedDirectionLabel(concept.meta)} · ${savedOutputLabel(concept.meta)} (AI concept mockup; image not included)`] : [])} />}
    </>
  );
}
