import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { getServerSession } from "next-auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeColorMeta from "@/components/ThemeColorMeta";
import AuthSessionProvider from "@/components/SessionProvider";
import ToastProvider from "@/components/ToastProvider";
import PwaRegister from "@/components/PwaRegister";
import { authOptions } from "@/lib/auth";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
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
  themeColor: "#0b84d8"
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
