import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import Link from "next/link";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Course Planner",
  description: "Course planning and skills tracking for instructors",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-screen font-sans">
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-bold text-lg text-gray-900">
                Course Planner
              </Link>
              <div className="flex gap-4 text-sm">
                <Link
                  href="/terms"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Terms
                </Link>
                <Link
                  href="/skills"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Skills
                </Link>
              </div>
            </div>
            {session?.user?.email ? (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>{session.user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/api/auth/signin" });
                  }}
                >
                  <button
                    type="submit"
                    className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </nav>
        <Providers>
          <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
