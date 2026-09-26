import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NicheScope | Coaching Niche Intelligence",
  description:
    "Scrape and analyze YouTube, Whop, and Skool to uncover market opportunities in the online coaching niche.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
