import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MissingKeysDialog } from "@/components/missing-keys-dialog";
import { OllamaProvider } from "@/lib/ollama-context";
import { Analytics } from '@vercel/analytics/next';
import { AuthInitializer } from "@/components/auth/auth-initializer";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PostHogProvider } from "@/components/posthog-provider";
import { logEnvironmentStatus } from "@/lib/env-validation";
import { ProviderSelector } from "@/components/providers/provider-selector";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "Patent Explorer | By Valyu",
    template: "%s | Patent Explorer | By Valyu",
  },
  description:
    "AI-powered patent search and innovation trends assistant with access to real USPTO patent data via Valyu API. Search patents, analyze trends, and explore innovation landscapes with accurate patent numbers (no hallucinations).",
  applicationName: "Patent Explorer | By Valyu",
  openGraph: {
    title: "Patent Explorer | By Valyu",
    description:
      "Search USPTO patents, analyze innovation trends, and explore technology landscapes. AI-powered patent research with real patent data via Valyu API - no hallucinated patent numbers.",
    url: "/",
    siteName: "Patent Explorer | By Valyu",
    images: [
      {
        url: "/valyu.png",
        width: 1200,
        height: 630,
        alt: "Patent Explorer | By Valyu",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Patent Explorer | By Valyu",
    description:
      "AI-powered patent search with real USPTO data via Valyu API. Search patents, analyze trends, visualize innovation landscapes. No hallucinated patent numbers.",
    images: ["/valyu.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Log environment status on server-side render (skip in development mode)
  if (typeof window === 'undefined' && process.env.NEXT_PUBLIC_APP_MODE !== 'development') {
    logEnvironmentStatus();
  }
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthInitializer>
              <PostHogProvider>
                <OllamaProvider>
                  <MissingKeysDialog />
                  <ProviderSelector />
                  {children}
                  <Analytics />
                </OllamaProvider>
              </PostHogProvider>
            </AuthInitializer>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}