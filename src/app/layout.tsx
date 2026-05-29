import type { Metadata, Viewport } from "next";
import { Archivo, DM_Mono, Lora } from "next/font/google";

import { SiteShell } from "@/components/SiteShell";
import { siteConfig } from "@/config/site";

import "./globals.css";

// Fonts matched to the print CV: Archivo (display), Lora (serif body), DM Mono (labels).
const displayFont = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const monoFont = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const serifFont = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  icons: {
    icon: [
      {
        url: "/favicon-qs-light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-qs-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicon.ico",
      },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          defer
          src="https://umami-production-e1ca.up.railway.app/script.js"
          data-website-id="a7b0e8f0-cf49-4cf7-a0e3-5b0b7137aa3b"
        />
      </head>
      <body className={`${displayFont.variable} ${monoFont.variable} ${serifFont.variable}`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
