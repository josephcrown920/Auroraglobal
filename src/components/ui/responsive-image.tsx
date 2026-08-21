import type { ImgHTMLAttributes } from "react";
import { LANDING_IMAGE_SRCSET } from "@/lib/landing-image-manifest";

type ResponsiveImageProps = ImgHTMLAttributes<HTMLImageElement> & { src: string };

/**
 * Drop-in <img> replacement for landing media. When WebP variants exist for
 * the given src (see scripts/optimize-landing-images.mjs), it renders a
 * <picture> whose <source> serves the responsive WebP srcset; the original
 * file stays as the <img> fallback, so a missing variant can never break the
 * page. All <img> props (className, loading, fetchPriority, width/height,
 * event handlers, ...) are forwarded to the inner <img>, which remains the
 * laid-out element. The <picture> uses display:contents so it adds no layout
 * box of its own — flex/grid parents see the <img> directly, keeping this a
 * true drop-in replacement for a bare <img>.
 */
export function ResponsiveImage({ src, sizes, ...rest }: ResponsiveImageProps) {
  const webpSrcSet = LANDING_IMAGE_SRCSET[src];
  if (!webpSrcSet) return <img src={src} sizes={sizes} {...rest} />;
  return (
    <picture style={{ display: "contents" }}>
      <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
      <img src={src} sizes={sizes} {...rest} />
    </picture>
  );
}
