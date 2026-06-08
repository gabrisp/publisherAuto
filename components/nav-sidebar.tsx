"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Smartphone,
  Users,
  ImageIcon,
  Music2,
  Film,
  Hash,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/carousels", label: "Carousels", icon: Film },
  { href: "/images", label: "Imágenes", icon: ImageIcon },
  { href: "/apps", label: "Apps", icon: Smartphone },
  { href: "/influencers", label: "Influencers", icon: Users },
  { href: "/hashtags", label: "Hashtags", icon: Hash },
  { href: "/tiktok", label: "TikTok", icon: Music2 },
];

function SidebarThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className="border-t p-3">
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        {isDark ? "Modo claro" : "Modo oscuro"}
      </button>
    </div>
  );
}

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-56 flex-col border-r bg-background">
      <div className="border-b px-4 py-4">
        <span className="text-lg font-bold tracking-tight">PlataformaAUTO</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              pathname === href || (href !== "/" && pathname.startsWith(href))
                ? "bg-muted text-foreground"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <SidebarThemeToggle />
    </aside>
  );
}
