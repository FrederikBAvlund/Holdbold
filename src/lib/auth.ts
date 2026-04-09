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

              const hasMembership = await prisma.membership.findFirst({
                where: { userId: user.id, status: { in: ["ACTIVE", "PENDING"] } },
                select: { id: true }
              });
              if (!hasMembership) return null;

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
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      if (token.id) {
        const memberships = await prisma.membership.findMany({
          where: { userId: token.id as string },
          select: { status: true }
        });
        const hasActiveMembership = memberships.some((membership) => membership.status === "ACTIVE");
        const hasPendingMembership = !hasActiveMembership && memberships.some((membership) => membership.status === "PENDING");
        token.hasActiveMembership = hasActiveMembership;
        token.hasPendingMembership = hasPendingMembership;

        // Uden navn/e-mail i JWT viser klienten "HB" mens SSR har initialer — hydration-fejl.
        // Gamle sessions kan mangle felter, fordi jwt-callback tidligere kun satte `id`.
        if (!token.name || !token.email) {
          const row = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, email: true, image: true }
          });
          if (row) {
            if (!token.name) token.name = row.name;
            if (!token.email) token.email = row.email;
            if (!token.picture) token.picture = row.image;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.hasActiveMembership = Boolean(token.hasActiveMembership);
        session.user.hasPendingMembership = Boolean(token.hasPendingMembership);
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.picture === "string") session.user.image = token.picture;
      }
      return session;
    }
  }
};
