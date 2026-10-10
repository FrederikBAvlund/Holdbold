import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { checkSlugAvailable, SLUG_ERROR_MESSAGES } from "@/lib/reservedSlugs";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const check = await checkSlugAvailable(slug);
  return NextResponse.json({
    slug: check.slug,
    available: check.ok,
    message: check.ok ? null : SLUG_ERROR_MESSAGES[check.reason]
  });
}
