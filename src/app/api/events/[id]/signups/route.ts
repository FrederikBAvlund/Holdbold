import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveProfileImageUrl } from "@/lib/profileImages";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const signups = await prisma.signup.findMany({
      where: { eventId: params.id },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    });

    const signupsWithResolvedImages = await Promise.all(
      signups.map(async (signup) => ({
        ...signup,
        user: {
          ...signup.user,
          image: await resolveProfileImageUrl(signup.user.image)
        }
      }))
    );

    return NextResponse.json({ signups: signupsWithResolvedImages });
  } catch (error) {
    console.error("Failed to load event signups", { eventId: params.id, error });
    return NextResponse.json({ error: "Kunne ikke hente tilmeldinger" }, { status: 500 });
  }
}
