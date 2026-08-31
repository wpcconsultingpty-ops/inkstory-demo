"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import ConceptImage from "./ConceptImage";

type Concept = {
  id: string;
  idx: number;
  image_url: string | null;
  prompt: string;
  meta: Record<string, any>;
};

type Props = {
  briefId: string;
  initialConcepts: Concept[];
  paid: boolean;
  briefStatus: string | null;
};

const NUM_DIRECTIONS = 3;

export default function ConceptsGrid({ briefId, initialConcepts, paid, briefStatus }: Props) {
  // Slots for each direction: whichever concept row exists at that idx, or null
  const [slots, setSlots] = useState<(Concept | null)[]>(() =>
    Array.from({ length: NUM_DIRECTIONS }, (_, i) => initialConcepts.find((c) => c.idx === i) ?? null)
  );
  const [pending, setPending] = useState<boolean[]>(() =>
    Array.from({ length: NUM_DIRECTIONS }, (_, i) => !initialConcepts.some((c) => c.idx === i && c.image_url))
  );
  const [errors, setErrors] = useState<(string | null)[]>(() =>
    Array.from({ length: NUM_DIRECTIONS }, () => null)
  );
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // If the brief is in a "generating" state OR any slot is missing an image,
    // kick off generation for the missing slots in parallel.
    const missing = slots
      .map((c, i) => (c && c.image_url ? -1 : i))
      .filter((i) => i >= 0);

    if (missing.length === 0) return;

    missing.forEach((idx) => generateOne(idx));
     
  }, []);

  async function generateOne(idx: number) {
    setPending((p) => {
      const next = [...p];
      next[idx] = true;
      return next;
    });
    setErrors((e) => {
      const next = [...e];
      next[idx] = null;
      return next;
    });

    try {
      const res = await fetch("/api/generate-one", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief_id: briefId, idx })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const { concept } = await res.json();
      setSlots((s) => {
        const next = [...s];
        next[idx] = concept;
        return next;
      });
    } catch (e: any) {
      setErrors((err) => {
        const next = [...err];
        next[idx] = e?.message ?? "Generation failed";
        return next;
      });
    } finally {
      setPending((p) => {
        const next = [...p];
        next[idx] = false;
        return next;
      });
    }
  }

  // If everything is now done, tell the brief status
  useEffect(() => {
    const allDone = slots.every((s) => s && s.image_url);
    if (allDone && briefStatus !== "concepts_ready") {
      const supa = createSupabaseBrowserClient();
      supa.from("briefs").update({ status: "concepts_ready" }).eq("id", briefId).then(() => {});
    }
     
  }, [slots]);

  const variantLabels = [
    "Considered & minimal",
    "Balanced & symbolic",
    "Dynamic & story-forward"
  ];

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-3">
      {Array.from({ length: NUM_DIRECTIONS }).map((_, i) => {
        const c = slots[i];
        const isPending = pending[i];
        const err = errors[i];
        return (
          <div key={i} className="card">
            <div className="pill">Direction {i + 1}</div>
            <div className="mt-4 aspect-square overflow-hidden rounded-xl border border-ink-ring bg-ink-edge">
              {c?.image_url ? (
                <ConceptImage src={c.image_url} alt={`Direction ${i + 1}`} paid={paid} index={i} />
              ) : isPending ? (
                <PendingTile />
              ) : err ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-xs text-ink-muted">
                  <p>Couldn&apos;t generate this direction.</p>
                  <p className="text-ink-muted/70">{err}</p>
                  <button
                    onClick={() => generateOne(i)}
                    className="rounded-full border border-ink-ring px-3 py-1 text-xs text-white hover:bg-white/5"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                  Waiting…
                </div>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-muted">{c?.meta?.variant ?? variantLabels[i]}</p>
          </div>
        );
      })}
    </div>
  );
}

function PendingTile() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent"></span>
        Generating high-detail concept…
      </div>
      <p className="text-[10px] text-ink-muted/60">~40–60 seconds</p>
    </div>
  );
}
