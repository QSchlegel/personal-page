import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";

import { SiteShell } from "@/components/SiteShell";
import { siteConfig } from "@/config/site";

import "./globals.css";

const uiFont = Manrope({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const displayFont = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      <body className={`${uiFont.variable} ${displayFont.variable}`}>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
