import type { Metadata } from "next";
import "@/theme/active-theme.css";
import "@/instance/homepage/homepage.css";
import "./globals.css";
import "@/instance/inner-pages.css";
import { themeCssVariables } from "@/config/theme.config";
import { getSiteIdentitySettings } from "@/db/repositories/site-settings";
import { canonicalUrl, getSiteUrl } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteIdentitySettings();

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: settings.defaultSeoTitle,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.defaultSeoDescription,
    alternates: {
      canonical: canonicalUrl("/"),
    },
    openGraph: {
      title: settings.defaultSeoTitle,
      description: settings.defaultSeoDescription,
      url: canonicalUrl("/"),
      siteName: settings.siteName,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: settings.defaultSeoTitle,
      description: settings.defaultSeoDescription,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={themeCssVariables()}>{children}</body>
    </html>
  );
}
