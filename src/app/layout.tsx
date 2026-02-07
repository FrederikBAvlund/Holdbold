import "./globals.css";
import type { Metadata } from "next";
import { Playfair_Display, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthSessionProvider from "@/components/SessionProvider";
import ToastProvider from "@/components/ToastProvider";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display"
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Holdbold",
  description: "Holdets kalender, tilmelding og bødekasse i ét system."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className={`${display.variable} ${sans.variable}`}>
      <body>
        <ThemeProvider />
        <AuthSessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
