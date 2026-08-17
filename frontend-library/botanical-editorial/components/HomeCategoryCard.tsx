import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ThemeImage } from "../media/media-types";

export type HomeCategoryCardProps = {
  title: ReactNode;
  href: string;
  description?: ReactNode;
  image: ThemeImage;
  layout?: "portrait" | "landscape";
};

export function HomeCategoryCard({ title, href, description, image }: HomeCategoryCardProps) {
  return (
    <Link className="botanical-topic-card" href={href}>
      <span className="botanical-topic-image">
        <Image src={image.src} alt={image.alt} fill sizes="(max-width: 767px) 72vw, 14vw" />
      </span>
      <span className="botanical-topic-body">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
        <span className="botanical-card-arrow" aria-hidden="true">
          -&gt;
        </span>
      </span>
    </Link>
  );
}
