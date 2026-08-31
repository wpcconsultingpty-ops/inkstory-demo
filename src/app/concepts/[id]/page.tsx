import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import RegenerateButton from "./RegenerateButton";
import MockPurchase from "./MockPurchase";
import ConceptsGrid from "./ConceptsGrid";

export const dynamic = "force-dynamic";

export default async function ConceptsPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/concepts/${params.id}`);

  const { data: brief } = await supabase.from("briefs").select("*").eq("id", params.id).maybeSingle();
  if (!brief) notFound();

  const { data: concepts } = await supabase
    .from("concepts")
    .select("*")
    .eq("brief_id", params.id)
    .order("idx", { ascending: true });

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("brief_id", params.id)
    .in("status", ["paid", "mock_paid"])
    .maybeSingle();

  const paid = !!order;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-ink-muted hover:text-white">← My briefs</Link>
        <RegenerateButton briefId={brief.id} />
      </header>

      <h1 className="font-display text-3xl">Three directions from your brief</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Each direction is a distinct interpretation of your brief. Preview them here — pick your favourite and unlock the
        Concept Pack for downloadable high-res files and the artist-ready PDF.
      </p>
      <ConceptsGrid
        briefId={brief.id}
        initialConcepts={(concepts ?? []) as any}
        paid={paid}
        briefStatus={brief.status ?? null}
      />

      {!paid && (
        <div className="card mt-10">
          <div className="pill border-accent/60 text-accent">Concept Pack — A$19</div>
          <h2 className="mt-3 font-display text-2xl">Take your concepts with you</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Preview is free. Unlock the pack to keep the artwork and take it to your artist.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-ink-muted">
            <li>Downloadable full-resolution concept images (watermark-free)</li>
            <li>Artist-ready PDF brief with placement and references</li>
            <li>Unlimited regenerations on this brief</li>
          </ul>
          <MockPurchase briefId={brief.id} />
        </div>
      )}

      <div className="mt-10">
        <details className="card">
          <summary className="cursor-pointer font-display">Your brief</summary>
          <div className="mt-4 space-y-2 text-sm">
            <Row k="Meaning" v={brief.meaning} />
            <Row k="Placement" v={brief.placement} />
            <Row k="Size" v={brief.size_cm} />
            <Row k="Style" v={brief.style} />
            <Row k="Palette" v={brief.palette} />
            <Row k="Elements" v={brief.key_elements} />
            <Row k="Notes" v={brief.reference_notes} />
          </div>
        </details>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-ink-muted">{k}</span>
      <span className="max-w-[70%] text-right text-white">{v || "—"}</span>
    </div>
  );
}
