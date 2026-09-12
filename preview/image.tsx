import type { ImageProps } from "next/image";

type Props = Pick<ImageProps, "src" | "alt" | "width" | "height" | "loading" | "decoding" | "className" | "onError" | "unoptimized">;

/** The isolated review can live under a deployment prefix, unlike Next's root. */
export function previewImageSrc(src: string) {
  return src.startsWith("/") && !src.startsWith("//") ? `.${src}` : src;
}

export default function Image({ src, unoptimized: _unoptimized, ...props }: Props) {
  const path = typeof src === "string" ? src : "default" in src ? src.default.src : src.src;
  return <img {...props} src={previewImageSrc(path)} />;
}
