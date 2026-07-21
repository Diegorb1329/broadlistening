import type { Metadata } from "next";
import Header from "../_components/Header";
import Footer from "../_components/Footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchProvider } from "../_components/SearchContext";
import { DataProviderWrapper } from "../_components/BroadListening/DataProviderWrapper";
import { ThemeProvider } from "@/lib/theme";

// Dashboard metadata. Dashboard URLs are parameterised by `?report=<url>`
// and render a different report each load, so we explicitly tell
// crawlers NOT to index the bare /dashboard route — there's no canonical
// content. Individual topic / claim / interview pages override this
// with their own metadata (and an indexable canonical) when they have
// stable data to surface.
const SITE_NAME = "Broad Listening";

export const metadata: Metadata = {
  title: {
    default: `Dashboard · ${SITE_NAME}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Explore an interactive Broad Listening report: navigate topics, claims, quotes and speaker demographics.",
  robots: { index: false, follow: true },
  openGraph: {
    title: `Dashboard · ${SITE_NAME}`,
    description:
      "Explore an interactive Broad Listening report: navigate topics, claims, quotes and speaker demographics.",
    siteName: SITE_NAME,
    images: [
      {
        url: "/img/og.jpg",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} dashboard: editorial AI for collective sensemaking`,
        type: "image/jpeg",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Dashboard · ${SITE_NAME}`,
    description:
      "Explore an interactive Broad Listening report: navigate topics, claims, quotes and speaker demographics.",
    images: ["/img/og.jpg"],
  },
};

// Mirror the root viewport tint so dashboard pages don't show a
// default white chrome on mobile.
export const viewport: import("next").Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f1a" },
  ],
  colorScheme: "light dark",
};

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <SearchProvider>
          <DataProviderWrapper>
            <Header />
            <main className="pt-6 pb-16 min-h-[calc(100vh-4rem)]">
              {children}
            </main>
            <Footer />
          </DataProviderWrapper>
        </SearchProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
