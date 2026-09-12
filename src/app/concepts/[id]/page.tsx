import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ConceptsGrid from "./ConceptsGrid";
import { BriefSummary } from "@/components/BriefFields";
import { draftFrom } from "@/components/brief-validation";
import { PilotLinks } from "@/components/PilotLinks";
import { accountConfigured } from "@/components/pilot-client";
import AccountUnavailable from "@/components/AccountUnavailable";
import { privateConcept, type Concept } from "./GenerationMetadata";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pilot concepts | InkStory", robots: { index: false, follow: false } };

export default async function ConceptsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!accountConfigured()) return <AccountUnavailable />;
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/concepts/${id}`)}`);
  const { data: brief, error: briefError } = await supabase.from("briefs").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (briefError) return <AccountUnavailable message="We could not load this brief. Try again later; your account data has not been intentionally removed." />;
  if (!brief) notFound();
  const { data: concepts, error } = await supabase.from("concepts").select("id,idx,image_url,meta,created_at").eq("brief_id", id).eq("user_id", user.id)
    .order("created_at", { ascending: false }).order("id", { ascending: false });
  if (error) return <AccountUnavailable message="We could not load your saved concepts. Do not generate replacements yet; refresh later to check your existing images." />;
  const draft = draftFrom(brief);
  // Never serialise stored object paths, public URLs or inline image data into the page.
  // Query order is newest first, with a deterministic tie-breaker. Keep one
  // canonical row per direction, even when older saved rows still exist.
  const canonical = new Map<number, Concept>();
  for (const row of concepts ?? []) {
    const concept = privateConcept(row);
    if (concept && !canonical.has(concept.idx)) canonical.set(concept.idx, concept);
  }
  const privateConcepts = [...canonical.values()];
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="py-3 text-sm text-ink-muted hover:text-white">← My briefs</Link>
        <Link href={`/brief?id=${encodeURIComponent(brief.id)}`} className="btn-ghost">Edit brief</Link>
      </header>
      <span className="pill">Invitation-only account pilot</span>
      <h1 className="mt-4 font-display text-3xl">Your generation review</h1>
      <p className="mt-3 text-ink-muted">Explore composition directions before requesting an AI concept mockup. Nothing generates on opening this page. These are references for a conversation with your artist, not finished designs or tattoo stencils. You can download your own saved images without a purchase.</p>
      <ConceptsGrid briefId={brief.id} initialConcepts={privateConcepts} brief={draft} />
      <section className="card mt-8" aria-labelledby="brief-title">
        <h2 id="brief-title" className="mb-6 font-display text-2xl">Saved brief</h2>
        <BriefSummary brief={draft} />
      </section>
      <PilotLinks />
    </main>
  );
}
