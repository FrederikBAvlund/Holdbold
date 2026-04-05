import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import * as XLSX from "xlsx";
import { authOptions } from "@/lib/auth";
import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type Row = Record<string, unknown>;

function subtractHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function toStringValue(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function toNumberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDanishDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number") {
    const serialDate = XLSX.SSF.parse_date_code(value);
    if (!serialDate) return null;
    return new Date(serialDate.y, serialDate.m - 1, serialDate.d);
  }

  const raw = toStringValue(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearRaw = Number(match[3]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseTime(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { hour: value.getHours(), minute: value.getMinutes() };
  }
  if (typeof value === "number") {
    const fraction = value % 1;
    const minutesTotal = Math.round(fraction * 24 * 60);
    const hour = Math.floor(minutesTotal / 60) % 24;
    const minute = minutesTotal % 60;
    return { hour, minute };
  }
  const raw = toStringValue(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 12, minute: 0 };
  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function sameOrNull(value: string) {
  return value.trim() || null;
}

async function requireAdminForTeam(teamId: string, userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { teamId, userId, status: "ACTIVE" },
    select: { role: true }
  });
  return membership?.role === "ADMIN";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const formData = await request.formData();
  const teamId = toStringValue(formData.get("teamId"));
  const file = formData.get("file");
  if (!teamId) {
    return NextResponse.json({ error: "Mangler teamId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Mangler Excel-fil" }, { status: 400 });
  }

  const canImport = await requireAdminForTeam(teamId, session.user.id);
  if (!canImport) {
    return NextResponse.json({ error: "Kun admin kan importere Excel" }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return NextResponse.json({ error: "Excel-filen indeholder ingen ark" }, { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
  if (rows.length === 0) {
    return NextResponse.json({ error: "Excel-filen indeholder ingen rækker" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  const deadlineHours = 24;

  for (const row of rows) {
    const matchNumber = toNumberValue(row["Kampnr"]);
    const datePart = parseDanishDate(row["Dato"]);
    if (!datePart) continue;
    const { hour, minute } = parseTime(row["Tid"]);
    const matchDate = new Date(
      datePart.getFullYear(),
      datePart.getMonth(),
      datePart.getDate(),
      hour,
      minute,
      0,
      0
    );

    const homeTeam = toStringValue(row["Hjemme"]);
    const awayTeam = toStringValue(row["Ude"]);
    const title = homeTeam || awayTeam ? `${homeTeam} - ${awayTeam}`.trim() : "Kamp";
    const location = toStringValue(row["Spillested"]);
    const externalUid = matchNumber
      ? `xlsx:${teamId}:${Math.trunc(matchNumber)}`
      : `xlsx:${teamId}:${matchDate.toISOString()}:${title.toLowerCase()}`;
    const signupDeadline = subtractHours(matchDate, deadlineHours);
    const meetingTime = subtractHours(matchDate, 1);

    const existing = await prisma.event.findFirst({
      where: {
        teamId,
        externalUid
      }
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          title,
          date: matchDate,
          location,
          signupDeadline,
          meetingTime: existing.meetingTime ?? meetingTime,
          source: "ICAL"
        }
      });
      updated += 1;
    } else {
      await prisma.event.create({
        data: {
          teamId,
          title,
          date: matchDate,
          location,
          signupDeadline,
          meetingTime,
          source: "ICAL",
          externalUid
        }
      });
      created += 1;
    }
  }

  if (created > 0) {
    const members = await prisma.membership.findMany({
      where: { teamId, status: "ACTIVE" },
      select: { userId: true }
    });
    const notifications = members
      .filter((member) => member.userId !== session.user.id)
      .map((member) => ({
        userId: member.userId,
        teamId,
        type: "EVENT" as const,
        title: "Kampkalender opdateret",
        body: `${created} nye kampe importeret fra Excel`,
        link: "/dashboard/kalender"
    }));
    if (notifications.length > 0) {
      await createNotifications(notifications);
    }
  }

  return NextResponse.json({
    created,
    updated,
    ignored: rows.length - created - updated,
    fileName: sameOrNull(file.name)
  });
}
