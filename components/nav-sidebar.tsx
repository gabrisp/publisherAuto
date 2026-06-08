"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Smartphone,
  Users,
  ImageIcon,
  Zap,
  Music2,
  Film,
  Hash,
} from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/apps", label: "Apps", icon: Smartphone },
  { href: "/influencers", label: "Influencers", icon: Users },
  { href: "/images", label: "Global Images", icon: ImageIcon },
  { href: "/generate", label: "Generate", icon: Zap },
  { href: "/carousels", label: "Carousels", icon: Film },
  { href: "/hashtags", label: "Hashtags", icon: Hash },
  { href: "/tiktok", label: "TikTok", icon: Music2 },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-background">
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
    </aside>
  );
}
