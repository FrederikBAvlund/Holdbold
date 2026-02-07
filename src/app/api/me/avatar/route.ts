import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function getExtension(filename: string, mime: string) {
  const ext = path.extname(filename);
  if (ext) return ext;
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/jpeg") return ".jpg";
  return ".jpg";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil uploadet" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Kun billeder er tilladt" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Filstørrelse er for stor (max 5MB)" }, { status: 400 });
  }

  const ext = getExtension(file.name, file.type);
  const filename = `${session.user.id}-${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "profiles");
  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  const imageUrl = `/uploads/profiles/${filename}`;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: imageUrl }
  });

  return NextResponse.json({ url: imageUrl });
}
