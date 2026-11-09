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

const SITE_URL = "https://pathify.art";
const SITE_TITLE = "Pathify | Raster to SVG Vector Graphics";
const SITE_DESCRIPTION =
  "Convert raster images (PNG, JPG, WebP) into clean, scalable SVG vector graphics entirely in your browser. Free previews, no uploads, no AI training on your images.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | Pathify",
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
  authors: [{ name: "pathify" }],
  creator: "pathify",
  publisher: "pathify",
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
    siteName: "pathify",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "pathify — Raster to SVG Vector Graphics Studio",
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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-256.png", sizes: "256x256", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      {
        rel: "mask-icon",
        url: "/mask-icon.svg",
        type: "image/svg+xml",
      },
    ],
  },
  other: {
    "msapplication-TileImage": "/mstile-150x150.png",
    "msapplication-TileColor": "#030509",
    "msapplication-config": "/browserconfig.xml",
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
      name: "Pathify",
      description: SITE_DESCRIPTION,
      inLanguage: ["en", "fr", "es", "it", "de", "pt", "zh", "ja", "ko"],
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Pathify",
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
        <noscript>
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 px-6 text-center text-neutral-100">
            <h1 className="text-2xl font-semibold">
              JavaScript is required
            </h1>
            <p className="max-w-md text-sm text-neutral-400">
              Pathify runs entirely in your browser using WebAssembly, so
              it needs JavaScript enabled to work. Please enable JavaScript in
              your browser settings and refresh the page.
            </p>
          </div>
        </noscript>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
