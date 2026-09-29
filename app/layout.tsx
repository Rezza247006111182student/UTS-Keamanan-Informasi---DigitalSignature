import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import AuthHeader from "@/lib/auth/AuthHeader";
import "./globals.css";

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif-4",
  weight: ["400", "600", "700"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NaturalSign — Aplikasi Digital Signature",
  description: "Aplikasi tanda tangan digital dokumen PDF dengan verifikasi QR-Code",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${sourceSerif4.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink font-sans antialiased flex flex-col overflow-x-hidden">
        {/* Header dasar bersama sesuai DESIGN_GUIDE.md Bagian 5 */}
        <header className="border-b border-border bg-paper sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-2">
                <span className="font-serif text-xl font-semibold tracking-tight text-ink">
                  Natural<span className="text-seal">Sign</span>
                </span>
              </Link>
              <nav className="hidden md:flex items-center space-x-6 text-sm text-ink-muted">
                <Link
                  href="/dashboard"
                  className="hover:text-ink transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/sign"
                  className="hover:text-ink transition-colors"
                >
                  Tanda Tangani
                </Link>
                <Link
                  href="/verify"
                  className="hover:text-ink transition-colors"
                >
                  Verifikasi
                </Link>
              </nav>
            </div>
            <AuthHeader />
          </div>
        </header>

        {/* Konten Halaman */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
