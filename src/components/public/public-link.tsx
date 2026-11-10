import type { ComponentPropsWithoutRef } from "react";

type PublicLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

export function PublicLink({ href, ...props }: PublicLinkProps) {
  return <a href={href} {...props} />;
}
