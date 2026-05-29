import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = (process.env.ALLOWED_EMAIL ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async signIn({ profile }) {
      return allowedEmails.includes(profile?.email ?? "");
    },
  },
});
