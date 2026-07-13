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
    async signIn({ profile, user }) {
      return isSignInEmailAllowed(profile?.email ?? user.email);
    },
  },
});
