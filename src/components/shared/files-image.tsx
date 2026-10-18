"use client";

import Image, { type ImageProps } from "next/image";
import { filesImageLoader } from "@/lib/image-loader";

/**
 * next/image for pictures served by /api/files/<id>/public. A loader function cannot be passed from a
 * Server Component, hence this thin client wrapper. Any other source falls back to the default optimizer.
 */
export function FilesImage({ src, ...props }: Omit<ImageProps, "loader">) {
  const own = typeof src === "string" && src.startsWith("/api/files/");
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is part of ImageProps and forwarded by the caller
  return <Image src={src} loader={own ? filesImageLoader : undefined} {...props} />;
}
