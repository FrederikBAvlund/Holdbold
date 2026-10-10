import { NextResponse } from "next/server";
import { runScheduledJobs } from "@/lib/runScheduledJobs";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // In development we allow manual calls without secret.
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (process.env.DISABLE_HTTP_CRON === "true") {
    return new NextResponse(null, { status: 404 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await runScheduledJobs());
}
