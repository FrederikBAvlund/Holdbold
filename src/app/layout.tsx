import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthSessionProvider from "@/components/SessionProvider";
import ToastProvider from "@/components/ToastProvider";
import PwaRegister from "@/components/PwaRegister";

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
    icon: "/brand/holdbold-mark-ball.svg",
    apple: "/brand/holdbold-mark-ball.svg"
  },
  appleWebApp: {
    capable: true,
    title: "Holdbold",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#d90429"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className={`${display.variable} ${sans.variable}`}>
      <body>
        <PwaRegister />
        <ThemeProvider />
        <AuthSessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
