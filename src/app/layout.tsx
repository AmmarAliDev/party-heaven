import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { AppToaster } from "@/components/providers/app-toaster";
import { AuthProvider } from "@/components/providers/auth-provider";
import { buildMetadata } from "@/config/metadata";
import { appViewport } from "@/config/viewport";
import { AnalyticsProvider } from "@/features/analytics/components/analytics-provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = buildMetadata();
export const viewport = appViewport;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full font-sans antialiased">
        <AuthProvider>
          {children}
          <AppToaster />
          <AnalyticsProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
