import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

export default function NotFound() {
  return (
    <main className="site-shell">
      <SiteHeader />
      <section className="btc-not-found" style={{backgroundImage:"url('/brand/budget-travel-compass/latest-road-trip.webp')"}}>
        <div className="btc-not-found-copy"><span className="eyebrow">404 · Route not found</span><h1>Looks like you took a wrong turn.</h1><p>The route you&apos;re looking for isn&apos;t here, but your next guide might be.</p><div className="btc-not-found-actions"><Link className="button" href="/">Back to home</Link><Link className="btc-button-secondary" href="/news">Explore travel guides</Link></div></div>
      </section>
      <SiteFooter />
    </main>
  );
}
