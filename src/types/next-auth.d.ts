import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hasActiveMembership?: boolean;
      hasPendingMembership?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    hasActiveMembership?: boolean;
    hasPendingMembership?: boolean;
  }
}
