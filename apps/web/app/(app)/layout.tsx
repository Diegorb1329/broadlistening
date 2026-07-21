import type { Metadata } from "next";
import Header from "../_components/Header";
import Footer from "../_components/Footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";

const SITE_NAME = "Broad Listening";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Turn comments into an explorable topic map and publish it to the AT Protocol network.",
  openGraph: {
    title: SITE_NAME,
    description:
      "Turn comments into an explorable topic map and publish it to the AT Protocol network.",
    siteName: SITE_NAME,
    images: [
      {
        url: "/img/og.jpg",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME}: editorial AI for collective sensemaking`,
        type: "image/jpeg",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Turn comments into an explorable topic map and publish it to the AT Protocol network.",
    images: ["/img/og.jpg"],
  },
};

// Mirror the root viewport tint so pages don't show default white chrome on mobile.
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
        <Header />
        <main className="pt-6 pb-16 min-h-[calc(100vh-4rem)]">{children}</main>
        <Footer />
      </TooltipProvider>
    </ThemeProvider>
  );
}
