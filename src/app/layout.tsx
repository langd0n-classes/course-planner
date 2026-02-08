import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Course Planner",
  description: "Course planning and skills tracking for instructors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-screen font-sans">
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-6">
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
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
