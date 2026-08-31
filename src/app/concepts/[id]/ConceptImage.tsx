"use client";

type Props = {
  src: string;
  alt: string;
  paid: boolean;
  index: number;
};

export default function ConceptImage({ src, alt, paid, index }: Props) {
  async function download() {
    // Only used when paid. Detect format from src to pick the right extension.
    // For remote URLs, fetch as blob so cross-origin downloads work; for data URLs, use direct link.
    let ext = "png";
    if (src.startsWith("data:image/svg")) ext = "svg";
    else if (src.startsWith("data:image/png")) ext = "png";
    else if (src.includes(".svg")) ext = "svg";

    let href = src;
    if (!src.startsWith("data:")) {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        href = URL.createObjectURL(blob);
      } catch {
        // fall back to direct link
      }
    }

    const a = document.createElement("a");
    a.href = href;
    a.download = `inkstory-direction-${index + 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (href !== src) URL.revokeObjectURL(href);
  }

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full select-none object-cover"
        draggable={false}
        onContextMenu={paid ? undefined : (e) => e.preventDefault()}
      />

      {/* Watermark overlay — only when unpaid */}
      {!paid && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="rotate-[-24deg] text-2xl font-semibold uppercase tracking-[0.35em] text-white/25 mix-blend-overlay">
            InkStory · Preview
          </span>
        </div>
      )}

      {/* Bottom-right corner — download button when paid, lock hint when not */}
      <div className="absolute bottom-2 right-2">
        {paid ? (
          <button
            onClick={download}
            className="rounded-full bg-black/70 px-3 py-1 text-xs text-white backdrop-blur transition hover:bg-black/90"
          >
            Download
          </button>
        ) : (
          <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur">
            Preview only
          </span>
        )}
      </div>
    </div>
  );
}
