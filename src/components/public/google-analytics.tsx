"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { buildAnalyticsPageLocation } from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer: unknown[][];
    gtag: (...args: unknown[]) => void;
  }
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer.push(args));
  return window.gtag;
}

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const gtag = ensureGtag();
    gtag("js", new Date());
    gtag("config", measurementId, {
      anonymize_ip: true,
      send_page_view: false,
    });
  }, [measurementId]);

  useEffect(() => {
    const gtag = ensureGtag();
    const pageLocation = buildAnalyticsPageLocation(window.location.origin, pathname);
    gtag("event", "page_view", {
      page_location: pageLocation,
      page_path: pathname,
      page_title: document.title,
    });
  }, [pathname]);

  return <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />;
}
