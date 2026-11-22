import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import {
  getPreviewAuthEmail,
  isSignInEmailAllowed,
} from "@/lib/auth-config";

const providers: NextAuthConfig["providers"] = [];
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const previewEmail = getPreviewAuthEmail();

if (googleClientId && googleClientSecret) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  );
}

if (previewEmail) {
  providers.push(
    Credentials({
      id: "course-planner-preview",
      name: "Development preview",
      credentials: {},
      authorize: async () => ({
        id: `preview:${previewEmail}`,
        email: previewEmail,
        name: "Preview Instructor",
      }),
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    async signIn({ account, profile, user }) {
      if (account?.provider === "google" && profile?.email_verified !== true) return false;
      return isSignInEmailAllowed(profile?.email ?? user.email);
    },
    async session({ session }) {
      if (!isSignInEmailAllowed(session.user?.email)) {
        // Keep the session envelope; authorization and route guards require a user.
        return { ...session, user: undefined } as unknown as typeof session;
      }
      return session;
    },
  },
});
