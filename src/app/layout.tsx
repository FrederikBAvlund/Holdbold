import "./globals.css";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getServerSession } from "next-auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { THEME_PRESETS } from "@/lib/themePresets";
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
    { path: "../../node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/barlow/files/barlow-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/barlow/files/barlow-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../../node_modules/@fontsource/barlow/files/barlow-latin-700-normal.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Holdbold",
  description: "Holdets kalender, tilmelding og bødekasse i ét system.",
  applicationName: "Holdbold",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon?v=2", type: "image/png" }],
    apple: [{ url: "/apple-icon?v=2", type: "image/png", sizes: "180x180" }],
    shortcut: [{ url: "/icon?v=2", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "Holdbold",
    // Appen tegnes helt op under statuslinjen (headeren tager højde for safe-area). iOS låser stilen ved installation.
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#121519" },
    { media: "(prefers-color-scheme: dark)", color: "#121519" }
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

// Sætter det gemte tema, før første tegning, så standardtemaet (mørkt) ikke blinker før et lyst valg.
const themeBootScript = `try{var t=localStorage.getItem("holdbold-theme");if(${JSON.stringify(THEME_PRESETS.map((preset) => preset.id))}.indexOf(t)>-1){document.documentElement.dataset.theme=t;var q=function(s,a){var l=document.querySelector(s);if(l)l.setAttribute("href",l.getAttribute("href").split("&theme=")[0].split("?theme=")[0]+a+t)};q('link[rel="manifest"]',"?theme=");document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]').forEach(function(l){l.setAttribute("href",l.getAttribute("href").split("&theme=")[0]+"&theme="+t)})}}catch(e){}`;

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="da" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <div className="status-scrim" aria-hidden />
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
