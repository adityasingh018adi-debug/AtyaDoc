import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastHost } from "@/components/ui/ToastHost";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const APP_URL = "https://atyadoc.in";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "AtyaDoc — Free Word to PDF, PDF to Word, OCR & Invoice Maker",
    template: "%s | AtyaDoc",
  },
  description:
    "AtyaDoc is a free all-in-one document tool. Convert Word to PDF, PDF to Word, extract text with OCR, create professional invoices & challans, and manage a business ledger — all in one place, no sign-up needed.",
  keywords: [
    "word to pdf", "pdf to word", "convert docx to pdf", "ocr scanner", "free pdf converter",
    "invoice maker", "challan maker", "business ledger", "khatabook", "document converter online",
    "free ocr", "extract text from image", "ai invoice generator", "atyadoc",
  ],
  authors: [{ name: "AtyaDoc", url: APP_URL }],
  creator: "AtyaDoc",
  publisher: "AtyaDoc",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "AtyaDoc",
    title: "AtyaDoc — Free Word to PDF, PDF to Word, OCR & Invoice Maker",
    description:
      "Free all-in-one document tool. Convert files, scan text with OCR, create invoices — no sign-up required.",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "AtyaDoc — Free Document Converter & Business Tools",
    description:
      "Word to PDF, PDF to Word, OCR scanner, AI invoice maker & more — free, fast, no login.",
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="h-full antialiased">
        <ThemeProvider>
          {children}
          <ToastHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
