"use client";

type Props = {
  src: string;
  alt: string;
  paid: boolean;
  index: number;
};

export default function ConceptImage({ src, alt, paid, index }: Props) {
  function download() {
    // Only used when paid — trigger a download of the SVG data URL.
    const a = document.createElement("a");
    a.href = src;
    a.download = `inkstory-direction-${index + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
