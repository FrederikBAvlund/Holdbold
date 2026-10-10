import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCAL_PROFILE_IMAGE_PREFIX, localProfileImagePath } from "@/lib/localProfileImages";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const target = localProfileImagePath(params.filename);
  if (!target) return new Response(null, { status: 404 });

  const owner = await prisma.user.findFirst({
    where: {
      image: `${LOCAL_PROFILE_IMAGE_PREFIX}${params.filename}`,
      OR: [
        { id: session.user.id },
        { memberships: { some: {
          status: "ACTIVE",
          team: { memberships: { some: { userId: session.user.id, status: "ACTIVE" } } }
        } } }
      ]
    },
    select: { id: true }
  });
  if (!owner) return new Response(null, { status: 404 });

  try {
    const data = await readFile(target);
    const extension = params.filename.split(".").pop()!;
    const type = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "X-Content-Type-Options": "nosniff"
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    throw error;
  }
}
