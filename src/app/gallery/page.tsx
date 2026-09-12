import type { Metadata } from "next";
import Link from "next/link";
import { PilotLinks } from "@/components/PilotLinks";
import { GALLERY_BRIEF_HREF, GALLERY_DISCLOSURE } from "@/lib/gallery";
import GalleryGrid from "./GalleryGrid";

export const metadata: Metadata = {
  title: "Concept gallery | InkStory",
  description: "Three original AI concept mockups on fictional placements. Fixed editorial inspiration, not completed tattoos or artwork generated from a user brief.",
  robots: { index: false, follow: false, nocache: true },
};

export default function GalleryPage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 pb-10">
      <a href="#gallery-collection" className="gallery-skip-link">Skip to concepts</a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-ring py-6">
        <Link href="/" className="py-3 font-display text-2xl" data-testid="link-gallery-home"><span aria-hidden="true" className="mr-2 font-sans text-sm text-ink-muted">←</span>InkStory</Link>
        <nav aria-label="Gallery navigation" className="flex flex-wrap gap-x-6 text-sm text-ink-muted">
          <Link href="/demo/sample" className="py-3 hover:text-white" data-testid="link-gallery-sample">Explore sample brief</Link>
          <Link href={GALLERY_BRIEF_HREF} className="py-3 text-accent-soft hover:text-white" data-testid="link-gallery-header-brief">Write a local brief</Link>
        </nav>
      </header>

      <section className="grid gap-6 pb-10 pt-10 md:grid-cols-[1.25fr_1fr] md:items-end md:pb-12 md:pt-16" aria-labelledby="gallery-title">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">The concept collection · 01—03</p>
          <h1 id="gallery-title" className="mt-4 font-display text-4xl leading-[1.12] md:text-5xl">Stories, imagined<br />in ink.</h1>
          <p className="mt-5 max-w-lg text-base text-ink-muted">Three original studies in strength, self-command and persistence. A place to explore visual ideas before beginning your own conversation.</p>
        </div>
        <div className="border-t border-ink-ring pt-5">
          <p className="text-sm text-accent-soft">AI concept mockups. Fictional placements.</p>
          <p className="mt-3 text-sm text-ink-muted">These are fixed editorial artworks for everyone to browse — not completed tattoos, not personalised results, and not generated from your brief.</p>
          <p className="mt-3 text-xs text-ink-muted">They are separate from the local brief’s abstract layout diagrams. Opening an image does not save it, select it for a brief or make an AI request.</p>
        </div>
      </section>

      <section id="gallery-collection" className="scroll-mt-6" aria-label="Three editorial tattoo concepts" tabIndex={-1}>
        <GalleryGrid />
      </section>

      <section className="mt-14 grid gap-6 border-y border-ink-ring py-8 md:mt-20 md:grid-cols-[1fr_1.5fr]" aria-labelledby="gallery-artist-title">
        <h2 id="gallery-artist-title" className="font-display text-2xl">Inspiration, not instructions.</h2>
        <div>
          <p className="text-sm text-ink-muted">{GALLERY_DISCLOSURE.artistReview}</p>
          <p className="mt-3 text-sm text-ink-muted">Use these images to talk about mood and meaning, not as a stencil or a promise of a finished result.</p>
        </div>
      </section>

      <section className="grid gap-6 py-10 md:grid-cols-[1.2fr_1fr] md:items-center" aria-labelledby="gallery-brief-title">
        <div>
          <h2 id="gallery-brief-title" className="font-display text-3xl">The next story is yours to write.</h2>
          <p className="mt-3 max-w-xl text-sm text-ink-muted">Start with what matters to you. The local planning flow captures a discussion brief and shows fixed abstract diagrams; it does not produce artwork like this gallery.</p>
        </div>
        <div>
          <Link href={GALLERY_BRIEF_HREF} className="btn-primary" data-testid="link-gallery-brief">Write a local brief</Link>
          <p className="mt-3 text-xs text-ink-muted">{GALLERY_DISCLOSURE.briefNotice}</p>
        </div>
      </section>
      <footer className="border-t border-ink-ring"><PilotLinks /></footer>
    </main>
  );
}
