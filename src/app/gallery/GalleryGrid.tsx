"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import GalleryImage from "@/components/GalleryImage";
import { GALLERY_BRIEF_HREF, GALLERY_CONCEPTS, GALLERY_DISCLOSURE, type GalleryConcept } from "@/lib/gallery";

function GalleryCard({ concept, index }: { concept: GalleryConcept; index: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
    };
  }, []);

  function openConcept() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });
  }

  function closeConcept() {
    dialogRef.current?.close();
    restoreFocus();
  }

  function restoreFocus() {
    // Native close events are asynchronous. A previous close must not release
    // the scroll lock or move focus if this dialog has already been reopened.
    if (dialogRef.current?.open) return;
    if (previousOverflow.current !== null) {
      document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    }
    openButtonRef.current?.focus({ preventScroll: true });
  }

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button, a[href]");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <article className="min-w-0" aria-labelledby={`${concept.id}-title`} data-testid={`card-gallery-${concept.id}`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-accent">{GALLERY_DISCLOSURE.label}</span>
        <span className="tabular-nums text-ink-muted">{concept.number} / 03</span>
      </div>
      <button
        ref={openButtonRef}
        type="button"
        className="gallery-open group block w-full overflow-hidden rounded-xl border border-ink-ring bg-ink-surface text-left transition-colors hover:border-accent/70"
        onClick={openConcept}
        aria-label={`View ${concept.title} concept`}
        aria-haspopup="dialog"
        aria-controls={`${concept.id}-detail`}
        aria-describedby={`${concept.id}-disclosure`}
        data-testid={`button-open-${concept.id}`}
      >
        <GalleryImage concept={concept} eager={index === 0} />
        <span className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm text-accent-soft">
          View concept <span aria-hidden="true">↗</span>
        </span>
      </button>
      <div className="pt-5">
        <p className="text-xs text-accent">{concept.theme}</p>
        <h2 id={`${concept.id}-title`} className="mt-2 font-display text-2xl leading-tight">{concept.title}</h2>
        <p className="mt-3 text-sm text-ink-muted">{concept.description}</p>
        <p className="mt-4 text-xs text-accent-soft">{GALLERY_DISCLOSURE.placement} · {concept.placement}</p>
        <p id={`${concept.id}-disclosure`} className="mt-2 text-xs text-ink-muted">{GALLERY_DISCLOSURE.provenance}</p>
      </div>

      <dialog
        ref={dialogRef}
        id={`${concept.id}-detail`}
        className="gallery-dialog"
        aria-labelledby={`${concept.id}-detail-title`}
        aria-describedby={`${concept.id}-detail-disclosure`}
        onClose={restoreFocus}
        onCancel={(event) => { event.preventDefault(); closeConcept(); }}
        onKeyDown={containTab}
        data-testid={`dialog-${concept.id}`}
      >
        <div className="gallery-dialog-toolbar">
          <p className="text-xs text-accent-soft">{GALLERY_DISCLOSURE.label} <span className="hidden sm:inline">· {GALLERY_DISCLOSURE.placement}</span></p>
          <button ref={closeButtonRef} type="button" className="btn-ghost shrink-0 px-4" onClick={closeConcept} aria-label={`Close ${concept.title} concept`} data-testid={`button-close-${concept.id}`}>
            Close <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="grid min-w-0 md:grid-cols-[1.1fr_1fr]">
          <figure className="min-w-0 bg-ink-bg">
            <GalleryImage concept={concept} className="gallery-detail-image" />
            <figcaption className="border-t border-ink-ring px-5 py-3 text-xs text-ink-muted">{GALLERY_DISCLOSURE.label} · {GALLERY_DISCLOSURE.placement}: {concept.placement}</figcaption>
          </figure>
          <div className="min-w-0 p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.14em] text-accent">Editorial study {concept.number}</p>
            <h2 id={`${concept.id}-detail-title`} className="mt-3 font-display text-3xl leading-tight">{concept.title}</h2>
            <p className="mt-2 text-sm text-accent-soft">{concept.theme}</p>
            <p id={`${concept.id}-detail-disclosure`} className="mt-5 text-sm text-ink-muted">{GALLERY_DISCLOSURE.provenance}</p>
            <p className="mt-5 text-sm">{concept.editorialNote}</p>
            <dl className="mt-6 grid gap-4 border-y border-ink-ring py-5 text-sm">
              <div><dt className="text-xs text-ink-muted">{GALLERY_DISCLOSURE.placement}</dt><dd className="mt-1">{concept.placement}</dd></div>
              <div><dt className="text-xs text-ink-muted">Visual language</dt><dd className="mt-1">{concept.motifs}</dd></div>
              <div><dt className="text-xs text-ink-muted">Palette</dt><dd className="mt-1">{concept.palette}</dd></div>
            </dl>
            <h3 className="mt-6 text-base font-medium">A question for your artist</h3>
            <p className="mt-2 text-sm text-accent-soft">{concept.artistQuestion}</p>
            <p className="mt-4 text-xs text-ink-muted">{GALLERY_DISCLOSURE.artistReview}</p>
            <Link href={GALLERY_BRIEF_HREF} className="btn-primary mt-6" data-testid={`link-brief-${concept.id}`}>Write a local brief</Link>
            <p className="mt-3 text-xs text-ink-muted">{GALLERY_DISCLOSURE.briefNotice}</p>
          </div>
        </div>
      </dialog>
    </article>
  );
}

export default function GalleryGrid() {
  return (
    <div className="grid gap-x-6 gap-y-12 md:grid-cols-3">
      {GALLERY_CONCEPTS.map((concept, index) => <GalleryCard key={concept.id} concept={concept} index={index} />)}
    </div>
  );
}
