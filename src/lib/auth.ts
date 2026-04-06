import type { NextAuthOptions } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/login"
  },
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
            name: "Email",
            credentials: {
              identifier: { label: "Email", type: "email" },
              password: { label: "Adgangskode", type: "password" }
            },
            async authorize(credentials) {
              const identifier = credentials?.identifier?.trim();
              const password = credentials?.password ?? "";

              if (!identifier || !password) return null;

              const user = await prisma.user.findFirst({
                where: {
                  email: { equals: identifier.toLowerCase(), mode: "insensitive" }
                }
              });

              if (!user?.passwordHash) return null;

              const valid = await bcrypt.compare(password, user.passwordHash);
              if (!valid) return null;

              const hasActiveMembership = await prisma.membership.findFirst({
                where: { userId: user.id, status: "ACTIVE" },
                select: { id: true }
              });
              if (!hasActiveMembership) return null;

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
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 90
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    }
  }
};
