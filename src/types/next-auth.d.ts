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
    hasActiveMembership?: boolean;
    hasPendingMembership?: boolean;
  }
}
