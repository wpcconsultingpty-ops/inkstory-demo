"use client";

import { useRef, useState } from "react";

export default function ConceptImage({ conceptId, index }: { conceptId: string; index: number }) {
  const src = `/api/concept-image/${encodeURIComponent(conceptId)}`;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const lock = useRef(false);

  async function download() {
    if (lock.current) return;
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
    <div>
      <div className="mt-4 aspect-square overflow-hidden rounded-xl border border-ink-ring bg-ink-edge">
        {failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm">
            <p role="status" className="text-ink-muted">This account image could not be loaded. Check your sign-in or try again later.</p>
            <button type="button" className="btn-ghost" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Retry loading image</button>
          </div>
        ) : (
          // Deliberately bypass image optimisation; this route needs the owner's session cookie.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={attempt} src={src} alt={`AI-assisted pilot concept, direction ${index + 1}. Requires artist review.`} width={1024} height={1024} className="h-full w-full object-contain" onError={() => setFailed(true)} />
        )}
      </div>
      <button type="button" className="btn-ghost mt-4 w-full" disabled={busy} onClick={() => void download()}>{busy ? "Downloading…" : `Download image ${index + 1}`}</button>
      {message && <p role="status" className="mt-3 text-sm text-accent-soft">{message}</p>}
    </div>
  );
}
