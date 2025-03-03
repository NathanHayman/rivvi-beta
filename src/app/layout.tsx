import "@/styles/globals.css";

import { type Metadata } from "next";

import Providers from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Inter } from "next/font/google";

export const metadata: Metadata = {
  title: "Rivvi",
  description: "Rivvi",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const headingFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${headingFont.variable} ${bodyFont.variable}`}
        suppressHydrationWarning
      >
        <body className="scroll-smooth bg-background font-sans antialiased">
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
