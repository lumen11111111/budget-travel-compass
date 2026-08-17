import type React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type HomeSectionHeadingProps = {
  title: React.ReactNode;
  deck?: React.ReactNode;
  href?: string;
  linkLabel?: React.ReactNode;
  icon?: React.ReactNode;
};

export function HomeSectionHeading({ title, deck, href, linkLabel, icon }: HomeSectionHeadingProps) {
  return (
    <div className="home-section-heading">
      <div>
        <h2>{title}</h2>
        {deck ? <p>{deck}</p> : null}
      </div>
      {href && linkLabel ? (
        <Link href={href}>
          {linkLabel}
          {icon ?? <ChevronRight size={17} aria-hidden="true" />}
        </Link>
      ) : null}
    </div>
  );
}
