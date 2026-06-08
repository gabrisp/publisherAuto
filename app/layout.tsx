import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavSidebar } from "@/components/nav-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PlataformaAUTO",
  description: "TikTok carousel generator platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <NavSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
                <span className="text-sm font-semibold md:hidden">AUTO</span>
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>
            </div>
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
