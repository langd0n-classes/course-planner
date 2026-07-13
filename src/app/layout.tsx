import type { Metadata } from "next";
import { auth, signOut } from "@/auth";
import Link from "next/link";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Course Planner",
  description: "Course design and live-term operations for instructors",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body className="antialiased bg-paper min-h-screen font-sans text-ink-soft">
        <a
          href="#main-content"
          className="sr-only z-50 rounded bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to workspace
        </a>
        <nav aria-label="Primary" className="border-b border-line bg-surface px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
                Course Planner
              </Link>
              <div className="flex gap-4 text-sm">
                <Link
                  href="/"
                  className="text-ink-muted hover:text-ink"
                >
                  Courses
                </Link>
              </div>
            </div>
            {session?.user?.email ? (
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <span className="hidden font-mono text-xs sm:inline">{session.user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/api/auth/signin" });
                  }}
                >
                  <button
                    type="submit"
                    className="rounded border border-line-strong px-3 py-1 text-ink-soft hover:bg-surface-sunken"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </nav>
        <Providers>
          <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
