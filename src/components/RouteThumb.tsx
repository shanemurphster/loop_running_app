import Image from "next/image";
import { MiniRoute } from "./MiniRoute";
import type { LngLat } from "@/lib/types";

// Fills its (positioned, sized) parent with either a route's real photo or,
// when it doesn't have one, a plain outline of its own path — no generic
// stock photo. Drop-in replacement for `<Image fill src={route.image} />`.
export function RouteThumb({
  image,
  path,
  alt,
  sizes,
  imageClassName,
}: {
  image?: string;
  path: LngLat[];
  alt: string;
  sizes?: string;
  imageClassName?: string;
}) {
  if (image) {
    return (
      <Image
        src={image}
        alt={alt}
        fill
        sizes={sizes}
        className={imageClassName ?? "object-cover"}
      />
    );
  }
  return (
    <MiniRoute path={path} width={400} height={300} className="absolute inset-0 h-full w-full" />
  );
}
