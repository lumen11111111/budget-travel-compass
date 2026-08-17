import type React from "react";
import { Mail } from "lucide-react";

export type NewsletterBlockProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  inputPlaceholder?: string;
  buttonLabel?: React.ReactNode;
  disabled?: boolean;
};

export function NewsletterBlock({
  title,
  description,
  icon,
  inputPlaceholder = "Email address",
  buttonLabel = "Coming soon",
  disabled = true,
}: NewsletterBlockProps) {
  return (
    <section className="home-newsletter-block" aria-labelledby="home-newsletter-title">
      <div>
        <span className="home-newsletter-icon">{icon ?? <Mail size={18} aria-hidden="true" />}</span>
        <h2 id="home-newsletter-title">{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <form aria-label="Newsletter preview">
        <input aria-label="Email address" disabled={disabled} placeholder={inputPlaceholder} type="email" />
        <button disabled={disabled} type="button">
          {buttonLabel}
        </button>
      </form>
    </section>
  );
}
