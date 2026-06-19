import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Tourney } from "next/font/google";
import { BAverageBadge } from "@/components/b-average-badge";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const tourney = Tourney({
  variable: "--font-tourney",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Toe the Slab - MLB Starting Pitcher Rankings & GS+ Scores",
    template: `%s | ${SITE_NAME}`,
  },
  description: "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Toe the Slab - MLB Starting Pitcher Rankings & GS+ Scores",
    description: "Daily starting-pitcher rankings, rolling form, probable matchups, and GS+ scores for every MLB start.",
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Toe the Slab MLB starting pitcher rankings" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Toe the Slab - MLB Starting Pitcher Rankings & GS+ Scores",
    description: "Daily starting-pitcher rankings, rolling form, probable matchups, and GS+ scores for every MLB start.",
    images: [{ url: "/opengraph-image", alt: "Toe the Slab MLB starting pitcher rankings" }],
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%BE%3C/text%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${tourney.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mt-auto px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <BAverageBadge />
          </div>
        </footer>
      </body>
    </html>
  );
}
