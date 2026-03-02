import type { Metadata } from "next";
import { Orbitron, Rajdhani } from "next/font/google";

import { siteConfig } from "@/config/site";

import "./globals.css";

const displayFont = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const bodyFont = Rajdhani({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
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
      <body className={`${displayFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
