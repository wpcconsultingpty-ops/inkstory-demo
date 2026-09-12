"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { BriefDraft } from "@/lib/brief";
import { generationError } from "@/components/pilot-client";
import { EarlyAccessLink } from "@/components/PilotLinks";
import ExportBrief from "@/components/ExportBrief";
import ConceptImage from "./ConceptImage";

export type Concept = {
  id: string;
  idx: number;
  image_url: string | null;
  meta: { variant?: string } | null;
};

const LABELS = ["Considered & minimal", "Balanced & symbolic", "Dynamic & story-forward"];

export default function ConceptsGrid({ briefId, initialConcepts, brief }: { briefId: string; initialConcepts: Concept[]; brief: BriefDraft }) {
  const [slots, setSlots] = useState<(Concept | null)[]>(() => LABELS.map((_, index) => initialConcepts.find((concept) => concept.idx === index) ?? null));
  const [pending, setPending] = useState<number | null>(null);
  const [errors, setErrors] = useState<(string | null)[]>([null, null, null]);
  const [revisions, setRevisions] = useState([0, 0, 0]);
  const lock = useRef(false);

  async function generateOne(index: number) {
    if (lock.current) return;
    lock.current = true;
    setPending(index);
    setErrors((current) => current.map((error, slot) => slot === index ? null : error));
    try {
      const response = await fetch("/api/generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief_id: briefId, idx: index }),
      });
      if (!response.ok) throw new Error(generationError(response.status));
      const { concept } = await response.json();
      if (!concept || typeof concept.id !== "string" || !/^[a-f0-9-]{36}$/i.test(concept.id) || concept.idx !== index || !concept.image_url) {
        throw new Error("The response did not confirm a saved image. Refresh to check before trying again; the request may still count towards your allowance.");
      }
      setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? concept as Concept : slot));
      setRevisions((current) => current.map((value, slot) => slot === index ? value + 1 : value));
    } catch (cause) {
      const message = cause instanceof Error && cause.name !== "TypeError" ? cause.message : "The generation request could not be confirmed. Check your connection and refresh for a saved result before retrying. A request may still count towards your allowance.";
      setErrors((current) => current.map((error, slot) => slot === index ? message : error));
    } finally {
      setPending(null);
      lock.current = false;
    }
  }
  return (
    <>
      <p className="mt-4 text-sm text-ink-muted">Nothing generates automatically when this page opens. Each request sends this saved brief to OpenAI and uses the pilot allowance, including failed attempts after generation has been reserved. A replacement appears only after it is saved successfully.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {LABELS.map((label, index) => {
          const concept = slots[index];
          const hasImage = !!concept?.image_url;
          return (
            <section key={index} className="card p-5" aria-labelledby={`direction-${index}`} aria-busy={pending === index}>
              <span className="pill">Pilot direction {index + 1}</span>
              <h2 id={`direction-${index}`} className="mt-3 text-lg font-medium">{typeof concept?.meta?.variant === "string" ? concept.meta.variant : label}</h2>
              {hasImage && concept ? <ConceptImage key={`${concept.id}-${revisions[index]}`} conceptId={concept.id} index={index} /> : (
                <div className="mt-4 flex aspect-square items-center justify-center rounded-xl border border-ink-ring bg-ink-edge p-5 text-center text-sm text-ink-muted">
                  {pending === index ? "Requesting an AI-assisted image. This can take a while; please keep this page open." : "No saved image for this direction. Generation requires an invited account and an available allowance."}
                </div>
              )}
              {pending === index && <p role="status" className="mt-3 text-sm text-accent-soft">Generation request in progress. Do not submit it again.</p>}
              {errors[index] && <div role="alert" className="mt-4 text-sm text-red-200">
                <p>{errors[index]}</p>
                <div className="mt-3 flex flex-col gap-3">
                  <Link className="underline" href={`/brief?id=${encodeURIComponent(briefId)}`}>Review your brief</Link>
                  <Link className="underline" href={`/auth/login?next=${encodeURIComponent(`/concepts/${briefId}`)}`}>Sign in again</Link>
                  <EarlyAccessLink className="underline" />
                </div>
              </div>}
              <button type="button" className="btn-ghost mt-4 w-full" onClick={() => void generateOne(index)} disabled={pending !== null}>
                {pending === index ? "Requesting…" : hasImage ? `Request replacement ${index + 1}` : `Request pilot image ${index + 1}`}
              </button>
            </section>
          );
        })}
      </div>
      <ExportBrief brief={brief} mode="account" labels={slots.flatMap((concept, index) => concept?.image_url ? [`Direction ${index + 1}: ${concept.meta?.variant || LABELS[index]} (AI-assisted; image not included)`] : [])} />
    </>
  );
}
