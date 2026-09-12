import type { BriefDraft } from "@/lib/brief";

/** Short, scannable brief facts, with the shared art-direction guidance available before confirmation. */
export default function GenerationIntent({ brief, styleNote, placementNote }: {
  brief: BriefDraft;
  styleNote: string;
  placementNote: string;
}) {
  return (
    <div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Style & palette intent</dt>
          <dd className="mt-1">{brief.style || "Style not recorded"}<p className="mt-1">Selected palette: {brief.palette || "Not recorded"}.</p></dd>
        </div>
        <div>
          <dt className="text-ink-muted">Placement & scale intent</dt>
          <dd className="mt-1">{brief.placement || "Placement not recorded"}<p className="mt-1">{brief.size_cm || "Size not recorded"}</p></dd>
        </div>
      </dl>
      <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-accent-soft">Read style & placement guidance</summary>
        <div className="mt-2 space-y-3 text-ink-muted">
          <p>{styleNote}</p>
          <p>{placementNote}</p>
        </div>
      </details>
    </div>
  );
}
