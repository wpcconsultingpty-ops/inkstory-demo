"use client";

import { useRef, useState } from "react";
import GenerationDialog from "./GenerationDialog";
import GenerationMetadata, { savedOutputLabel, type ConceptMeta } from "./GenerationMetadata";

export default function ConceptImage({ conceptId, index, meta = null, previewOnly = false }: {
  conceptId: string;
  index: number;
  meta?: ConceptMeta | null;
  previewOnly?: boolean;
}) {
  const src = `/api/concept-image/${encodeURIComponent(conceptId)}`;
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedFailed, setExpandedFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  const outputLabel = savedOutputLabel(meta);
  const alt = `AI concept mockup, saved direction ${index + 1}. ${outputLabel}. Requires artist review.`;

  async function download() {
    if (lock.current) return;
    if (previewOnly) {
      setMessage("Isolated preview: no request sent");
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(src, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        setMessage(response.status === 401 || response.status === 403
          ? "Sign in to the account that owns this image, then try again."
          : "The image could not be downloaded. It may be unavailable; refresh this page or try again later.");
        return;
      }
      const blob = await response.blob();
      const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
      const extension = extensions[blob.type];
      if (!extension || blob.size === 0) throw new Error("Invalid image");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `inkstory-pilot-direction-${index + 1}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Image download requested. This is an AI-assisted discussion reference, not a finished tattoo design.");
    } catch {
      setMessage("The image could not be downloaded. Check your connection or open InkStory in a full browser tab and try again.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div data-testid={`saved-image-${index}`}>
      <p className="mt-5 text-xs text-accent">Saved image · AI concept mockup</p>
      <div className="mt-3 aspect-[2/3] overflow-hidden rounded-xl border border-ink-ring bg-ink-edge">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm">
            <p role="status" className="text-ink-muted">This account image could not be loaded. Check your sign-in or try again later.</p>
            <button type="button" className="btn-ghost" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Retry loading image only</button>
          </div>
        ) : (
          // Deliberately bypass image optimisation; this route needs the owner's session cookie.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={attempt} src={src} alt={alt} width={1024} height={1536} decoding="async" className="h-full w-full object-contain" onError={() => setFailed(true)} />
        )}
      </div>
      <GenerationMetadata meta={meta} />
      <button type="button" className="btn-ghost mt-3 w-full" aria-haspopup="dialog" onClick={() => { setExpandedFailed(false); setExpanded(true); }} data-testid={`button-expand-image-${index}`}>View full-size image {index + 1}</button>
      <button type="button" className="btn-ghost mt-4 w-full" disabled={busy} onClick={() => void download()}>{busy ? "Downloading…" : `Download image ${index + 1}`}</button>
      <p className="mt-3 text-xs text-ink-muted">Saved settings belong to this image and may reflect an earlier brief. This is not an artist-approved tattoo.</p>
      {message && <p role="status" className="mt-3 text-sm text-accent-soft">{message}</p>}
      {expanded && (
        <GenerationDialog titleId={`image-title-${index}`} descriptionId={`image-disclosure-${index}`} onClose={() => setExpanded(false)} wide>
          <div className="gallery-dialog-toolbar">
            <h2 id={`image-title-${index}`} className="text-base font-medium">Saved image {index + 1}</h2>
            <button type="button" className="btn-ghost" data-dialog-focus onClick={() => setExpanded(false)} data-testid={`button-close-image-${index}`}>Close image</button>
          </div>
          <figure className="p-4 sm:p-6">
            {expandedFailed ? (
              <p role="status" className="py-10 text-center text-sm text-ink-muted">This private image could not be loaded. Close this view, check your sign-in and retry loading the image.</p>
            ) : (
              // The full resolution is served by the same owner-only route, never a storage URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt} width={1024} height={1536} decoding="async" className="mx-auto h-auto max-h-[75dvh] w-full object-contain" onError={() => setExpandedFailed(true)} />
            )}
            <figcaption id={`image-disclosure-${index}`} className="mt-4 text-sm">
              <p className="text-accent-soft">AI concept mockup · {outputLabel}</p>
              <p className="mt-2 text-ink-muted">Not a completed tattoo, stencil or proof of fit. An artist must review and adapt placement, scale, detail and tattooability.</p>
            </figcaption>
            <GenerationMetadata meta={meta} />
          </figure>
        </GenerationDialog>
      )}
    </div>
  );
}
