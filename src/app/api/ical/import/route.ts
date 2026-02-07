import { NextResponse } from "next/server";
import { z } from "zod";
import * as ical from "node-ical";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  teamId: z.string().min(1),
  url: z.string().url(),
  name: z.string().min(1).optional()
});

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);

  const response = await fetch(body.url);
  if (!response.ok) {
    return NextResponse.json({ error: "Kunne ikke hente iCal" }, { status: 400 });
  }

  const icsText = await response.text();
  const parsed = ical.parseICS(icsText);

  const feed = await prisma.icalFeed.upsert({
    where: { url: body.url },
    create: {
      teamId: body.teamId,
      name: body.name ?? "DBU iCal",
      url: body.url,
      lastImportedAt: new Date()
    },
    update: {
      name: body.name ?? "DBU iCal",
      lastImportedAt: new Date()
    }
  });

  let created = 0;
  let updated = 0;

  const events = Object.values(parsed).filter((entry) => entry.type === "VEVENT");

  for (const event of events) {
    const uid = String(event.uid ?? "");
    const start = event.start instanceof Date ? event.start : null;
    if (!uid || !start) continue;

    const title = event.summary ? String(event.summary) : "Kamp";
    const location = event.location ? String(event.location) : "";
    const signupDeadline = addHours(start, -24);

    const existing = await prisma.event.findFirst({
      where: {
        teamId: body.teamId,
        externalUid: uid
      }
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          title,
          date: start,
          location,
          signupDeadline,
          feedId: feed.id,
          source: "ICAL"
        }
      });
      updated += 1;
    } else {
      await prisma.event.create({
        data: {
          teamId: body.teamId,
          title,
          date: start,
          location,
          signupDeadline,
          source: "ICAL",
          externalUid: uid,
          feedId: feed.id
        }
      });
      created += 1;
    }
  }

  return NextResponse.json({ created, updated, feedId: feed.id });
}
