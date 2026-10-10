import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveProfileImageUrl } from "@/lib/profileImages";
import { randomUUID } from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { LOCAL_PROFILE_IMAGE_PREFIX, localProfileImagePath, profileImageExtension } from "@/lib/localProfileImages";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const SUPABASE_BUCKET = process.env.SUPABASE_PROFILE_BUCKET ?? "profile-images";

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

  const ext = process.env.LOCAL_PROFILE_UPLOAD_DIR
    ? profileImageExtension(file.type)
    : getExtension(file.name, file.type);
  if (!ext) return NextResponse.json({ error: "Billedformatet understøttes ikke" }, { status: 400 });
  const filename = `${session.user.id}-${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedImageValue: string;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (process.env.LOCAL_PROFILE_UPLOAD_DIR) {
    const target = localProfileImagePath(filename);
    if (!target) return NextResponse.json({ error: "Billedlager er ikke konfigureret korrekt" }, { status: 500 });
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    storedImageValue = `${LOCAL_PROFILE_IMAGE_PREFIX}${filename}`;
  } else if (supabaseUrl && supabaseServiceRoleKey) {
    const objectPath = `profiles/${filename}`;
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          apikey: supabaseServiceRoleKey,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "true"
        },
        body: buffer
      }
    );

    if (!uploadResponse.ok) {
      const details = await uploadResponse.text();
      return NextResponse.json(
        {
          error:
            "Kunne ikke gemme profilbillede i storage. Tjek at bucket findes og at SUPABASE_SERVICE_ROLE_KEY er korrekt.",
          details
        },
        { status: 500 }
      );
    }

    storedImageValue = `supabase:${objectPath}`;
  } else if (process.env.VERCEL) {
    return NextResponse.json(
      {
        error:
          "Upload er ikke konfigureret i produktion. Sæt SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i environment variables."
      },
      { status: 500 }
    );
  } else {
    const uploadDir = path.join(process.cwd(), "public", "uploads", "profiles");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    storedImageValue = `/uploads/profiles/${filename}`;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { image: storedImageValue }
  });

  const resolvedUrl = await resolveProfileImageUrl(storedImageValue);
  return NextResponse.json({ url: resolvedUrl ?? storedImageValue });
}
