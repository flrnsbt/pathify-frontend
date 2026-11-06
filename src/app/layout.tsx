import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://vectorizerr.pages.dev";
const SITE_TITLE = "Vectorizerr | Raster to SVG Vector Graphics";
const SITE_DESCRIPTION =
  "Convert raster images (PNG, JPG, WebP) into clean, scalable SVG vector graphics entirely in your browser. Powered by VTracer WebAssembly — free previews, no uploads, no AI training on your images.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Vectorizerr",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "raster to svg",
    "image vectorizer",
    "png to svg",
    "jpg to svg",
    "vectorize image",
    "svg converter",
    "logo vectorizer",
    "bitmap to vector",
    "vtracer",
    "free svg converter",
  ],
  authors: [{ name: "vectorizerr" }],
  creator: "vectorizerr",
  publisher: "vectorizerr",
  category: "Multimedia",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "vectorizerr",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "vectorizerr — Raster to SVG Vector Graphics Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Vectorizerr",
      description: SITE_DESCRIPTION,
      inLanguage: ["en", "fr", "es", "it", "de", "pt", "zh", "ja", "ko"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Vectorizerr",
      url: SITE_URL,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Client-side raster to SVG vectorization via WebAssembly (VTracer)",
        "Adjustable trace presets: photo, logo, line art, pixel art, gradient",
        "Multiple vectorization engines including VTracer 2.0.10 and 1.0.0-alpha",
        "Free PNG/WebP raster exports",
        "Cloud history and parameter sync for signed-in users",
        "Crypto credit payments with on-chain verification",
        "Interface available in 9 languages",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 selection:bg-indigo-500 selection:text-white"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
