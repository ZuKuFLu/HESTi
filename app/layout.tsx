import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HESTi — Understand your contractor's change order",
  description:
    "Upload your original quote and a change order. HESTi compares them, checks the math and tells you what to ask your contractor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="border-b">
            <div className="mx-auto flex max-w-[1100px] items-center px-5 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                HESTi
              </Link>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-12">{children}</main>

          <footer className="border-t">
            <div className="mx-auto max-w-[1100px] px-5 py-6 text-xs text-muted-foreground">
              Not legal, financial or construction advice. Flags are questions to ask, not
              accusations.
            </div>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
