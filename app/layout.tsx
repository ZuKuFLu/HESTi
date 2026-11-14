import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { House } from "lucide-react";
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
  title: "HESTi — Know what you're paying for",
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
        {/* Warm wash at the top of every page. Fixed and decorative, so it
            can never widen the layout the way a full-bleed section would. */}
        <div
          aria-hidden
          className="hearth-glow pointer-events-none fixed inset-x-0 top-0 h-[36rem]"
        />
        <div className="relative flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-3.5">
              <Link
                href="/"
                className="group flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:-translate-y-px">
                  <House className="size-4.5" />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  HESTi
                </span>
              </Link>
              <span className="text-xs text-muted-foreground">
                Change orders, in plain English
              </span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 py-12">
            {children}
          </main>

          <footer className="mt-8 border-t border-border/70">
            <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-5 py-8 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <House className="size-3.5 text-primary" />
                HESTi
              </p>
              <p className="max-w-2xl">
                Not legal, financial or construction advice. Flags are questions
                to ask, not accusations.
              </p>
            </div>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
