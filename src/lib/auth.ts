import type { NextAuthOptions } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET
          })
        ]
      : []),
    ...(process.env.AUTH_CREDENTIALS_ENABLED === "true"
      ? [
          Credentials({
            name: "Email eller telefon",
            credentials: {
              identifier: { label: "Email eller telefon", type: "text" },
              password: { label: "Adgangskode", type: "password" }
            },
            async authorize(credentials) {
              const identifier = credentials?.identifier?.trim();
              const password = credentials?.password ?? "";

              if (!identifier || !password) return null;

              const user = await prisma.user.findFirst({
                where: {
                  OR: [{ email: identifier }, { phone: identifier }]
                }
              });

              if (!user?.passwordHash) return null;

              const valid = await bcrypt.compare(password, user.passwordHash);
              if (!valid) return null;

              return {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image
              };
            }
          })
        ]
      : [])
  ],
  session: { strategy: "jwt" }
};
