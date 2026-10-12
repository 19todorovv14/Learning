import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { themeScript } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: {
    default: "BG LEARN — Разбери всичко, което учиш",
    template: "%s · BG LEARN",
  },
  description:
    "Ясни уроци, записки за тетрадката, тестове и AI учител — от 1. клас до университета, матурите, професионалните и шофьорските изпити.",
  applicationName: "BG LEARN",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        {/* Тема (светла/тъмна) преди първото изрисуване; next/script не участва в хидратацията на React */}
        <Script id="bgl-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-pop">
          Към съдържанието
        </a>
        {children}
      </body>
    </html>
  );
}
