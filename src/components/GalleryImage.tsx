"use client";

import { useState } from "react";
import Image from "next/image";
import type { GalleryConcept } from "@/lib/gallery";

/** Local, pre-made editorial images. No image provider or account is involved. */
export default function GalleryImage({
  concept,
  eager = false,
  className = "",
}: {
  concept: GalleryConcept;
  eager?: boolean;
  className?: string;
}) {
  const [unavailable, setUnavailable] = useState(false);

  if (unavailable) {
    return (
      <span className={`flex aspect-[3/4] items-center justify-center bg-ink-edge p-8 text-center ${className}`} role="img" aria-label={concept.alt}>
        <span>
          <span className="block text-accent-soft">Concept image unavailable</span>
          <span className="mt-3 block text-sm text-ink-muted">You can still read the editorial notes for {concept.title}.</span>
        </span>
      </span>
    );
  }

  return (
    <Image
      src={concept.image}
      alt={concept.alt}
      width={1086}
      height={1448}
      unoptimized
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={`aspect-[3/4] h-auto w-full bg-ink-edge object-contain ${className}`}
      onError={() => setUnavailable(true)}
    />
  );
}
