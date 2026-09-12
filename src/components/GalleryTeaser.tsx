import Link from "next/link";
import GalleryImage from "@/components/GalleryImage";
import { GALLERY_CONCEPTS, GALLERY_DISCLOSURE } from "@/lib/gallery";

export default function GalleryTeaser() {
  const featured = GALLERY_CONCEPTS[0];

  return (
    <aside aria-labelledby="gallery-teaser-title" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="uppercase tracking-[0.16em] text-accent">The concept collection</span>
        <span className="text-ink-muted">01 / 03</span>
      </div>
      <Link href="/gallery" className="group block overflow-hidden rounded-xl border border-ink-ring bg-ink-surface hover:border-accent/70" data-testid="link-gallery-teaser" aria-labelledby="gallery-teaser-title gallery-teaser-action">
        <div className="relative">
          <GalleryImage concept={featured} eager />
          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-ink-bg/95 px-3 py-1 text-xs text-accent-soft">{GALLERY_DISCLOSURE.label}</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-accent">{featured.theme} · {GALLERY_DISCLOSURE.placement}</p>
          <h2 id="gallery-teaser-title" className="mt-2 font-display text-2xl">{featured.title}</h2>
          <p className="mt-2 text-xs text-ink-muted">{GALLERY_DISCLOSURE.provenance}</p>
          <p id="gallery-teaser-action" className="mt-4 flex items-center justify-between gap-3 text-sm text-accent-soft">Explore all three concepts <span aria-hidden="true">↗</span></p>
        </div>
      </Link>
    </aside>
  );
}
