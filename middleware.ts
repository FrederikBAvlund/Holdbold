import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/glemt-password",
  "/nulstil-password",
  "/offline",
  "/privatliv",
  "/slet-data",
  // App-ikoner skal kunne hentes uden login (favicon på login-siden, "Føj til hjemmeskærm").
  "/icon",
  "/apple-icon",
  "/maskable-icon"
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Kalenderprogrammer (Apple Kalender m.fl.) abonnerer uden cookies – feedet har sin egen hemmelige nøgle.
  if (pathname.startsWith("/api/calendar/feed/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const apiToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });
    if (!apiToken) {
      return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (callbackPath && callbackPath !== "/login") {
      loginUrl.searchParams.set("callbackUrl", callbackPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  const isDashboardPath = pathname.startsWith("/dashboard");
  const isSettingsPath =
    pathname === "/dashboard/profil" ||
    pathname.startsWith("/dashboard/profil/") ||
    pathname === "/dashboard/indstillinger" ||
    pathname.startsWith("/dashboard/indstillinger/");
  const hasActiveMembership = token.hasActiveMembership === true;

  if (isDashboardPath && !isSettingsPath && !hasActiveMembership) {
    const settingsUrl = new URL("/dashboard/profil", request.url);
    settingsUrl.searchParams.set("notice", "pending_approval");
    return NextResponse.redirect(settingsUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|brand|uploads|api/auth|api/health|api/cron).*)"
  ]
};
