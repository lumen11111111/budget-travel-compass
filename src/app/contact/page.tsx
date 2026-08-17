import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getResolvedLegalConfig } from "@/lib/legal-settings";
import Image from "next/image";
import { budgetTravelArtwork } from "@/instance/brand-assets";

export async function generateMetadata(): Promise<Metadata> {
  const { pages } = await getResolvedLegalConfig();
  return {
    title: pages.contact.metadataTitle,
    description: pages.contact.metadataDescription,
  };
}

export default async function ContactPage() {
  const { identity, pages } = await getResolvedLegalConfig();
  const page = pages.contact;

  return (
    <main className="site-shell">
      <SiteHeader />
      <div className="btc-contact-grid">
        <form className="btc-contact-form" aria-describedby="contact-preview-note">
          <span className="eyebrow">Contact</span><h1>Get in touch</h1><p>{page.intro}</p>
          <label>Name<input disabled name="name" /></label>
          <label>Email<input disabled name="email" type="email" /></label>
          <label>Subject<input disabled name="subject" /></label>
          <label>Message<textarea disabled name="message" rows={6} /></label>
          <button className="button" disabled type="button">Send message</button>
          <p id="contact-preview-note">This form is not enabled and does not send submissions. Please use the email channel shown here.</p>
        </form>
        <aside className="btc-contact-aside">
          <Image src={budgetTravelArtwork.postcardStamp} alt="" width={420} height={416} aria-hidden="true" />
          <span className="eyebrow">Email</span>
          <h2>One contact channel for every travel note.</h2>
          <a className="btc-contact-email" href={`mailto:${identity.contactEmail}`}>{identity.contactEmail}</a>
          <h3>What you can contact us about</h3>
          <ul className="btc-contact-topics">{page.contactPanels.map(label => <li key={label}>{label}</li>)}</ul>
          <p>{page.responseTime}</p>
        </aside>
      </div>
      <SiteFooter />
    </main>
  );
}
