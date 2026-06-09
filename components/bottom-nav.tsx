"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Film, ImageIcon, Music2, LayoutDashboard, LogOut } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const links = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/carousels", label: "Carousels", icon: Film },
  { href: "/images", label: "Imágenes", icon: ImageIcon },
  { href: "/tiktok", label: "TikTok", icon: Music2 },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-background/95 backdrop-blur-sm md:hidden">
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              active ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
      >
        <LogOut className="h-5 w-5 stroke-[1.5]" />
        <span className="text-[10px] font-medium">Salir</span>
      </button>
    </nav>
  );
}
