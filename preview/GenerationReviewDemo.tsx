import Link from "next/link";
import ConceptsGrid from "../src/app/concepts/[id]/ConceptsGrid";
import { BriefSummary } from "../src/components/BriefFields";
import type { BriefDraft } from "../src/lib/brief";

const syntheticBrief: BriefDraft = {
  meaning: "A fictional planning brief about staying grounded through change.",
  placement: "Inner forearm",
  size_cm: "Medium (8–15cm)",
  style: "Black-and-grey realism",
  key_elements: "An oak tree as the dominant motif; exposed roots and a small crescent moon as supports.",
  palette: "Black and grey",
  reference_notes: "Avoid: lettering, birds, colour accents and copied artist designs. Ask an artist how much root detail will age clearly.",
};

export default function GenerationReviewDemo() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="py-3 text-sm text-ink-muted hover:text-white">← Preview home</Link>
      <p className="mt-5 text-xs text-accent">Isolated interaction demonstration</p>
      <h1 className="mt-4 font-display text-3xl">Review a generation request</h1>
      <p className="mt-3 text-ink-muted">Try the real review controls with the fictional brief below. No account is connected, no images are supplied as results, and confirmation never sends a request or uses an allowance. Nothing is saved.</p>
      <ConceptsGrid briefId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" initialConcepts={[]} brief={syntheticBrief} previewOnly />
      <section className="card mt-8" aria-labelledby="synthetic-brief-title">
        <h2 id="synthetic-brief-title" className="mb-6 text-xl font-medium">Fictional brief used in this demonstration</h2>
        <BriefSummary brief={syntheticBrief} />
      </section>
    </main>
  );
}
