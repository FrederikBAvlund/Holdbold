import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getServerSession } from "next-auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeColorMeta from "@/components/ThemeColorMeta";
import AuthSessionProvider from "@/components/SessionProvider";
import ToastProvider from "@/components/ToastProvider";
import PwaRegister from "@/components/PwaRegister";
import { authOptions } from "@/lib/auth";

// Skrifttyper self-hostes (via @fontsource) så build ikke afhænger af fonts.googleapis.com.
const display = localFont({
  src: [
    { path: "../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal" }
  ],
  variable: "--font-display"
});

const sans = localFont({
  src: [
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Holdbold",
  description: "Holdets kalender, tilmelding og bødekasse i ét system.",
  applicationName: "Holdbold",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    shortcut: [{ url: "/icon", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Holdbold",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1220" }
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="da" className={`${display.variable} ${sans.variable}`}>
      <body>
        <PwaRegister />
        <ThemeProvider />
        <ThemeColorMeta />
        <AuthSessionProvider session={session}>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
