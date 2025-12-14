import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { env } from "@/env.mjs";
import { prisma } from "@/lib/prisma";

const allowedDomains = ["dealerinspire.com", "cars.com"];

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  providers: [
    GoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? "";
      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain) {
        return false;
      }
      return allowedDomains.includes(domain);
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  secret: env.NEXTAUTH_SECRET,
};
