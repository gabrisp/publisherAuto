"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Film, ImageIcon, Music2, LayoutDashboard, LogOut,
  UserCircle, CalendarRange, MoreHorizontal, X,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const mainLinks = [
  { href: "/", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/schedule", label: "Timeline", icon: CalendarRange },
  { href: "/carousels", label: "Carousels", icon: Film },
  { href: "/images", label: "Imágenes", icon: ImageIcon },
];

const extraLinks = [
  { href: "/users", label: "Usuarios", icon: UserCircle },
  { href: "/tiktok", label: "TikTok", icon: Music2 },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  return (
    <>
      {/* Extras sheet */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden bg-background border-t rounded-t-2xl shadow-2xl px-4 pt-4 pb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold">Más</span>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {extraLinks.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname.startsWith(href) ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t bg-background/95 backdrop-blur-sm md:hidden">
        {mainLinks.map(({ href, label, icon: Icon, exact }) => {
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
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
            open ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <MoreHorizontal className={`h-5 w-5 ${open ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
          <span className="text-[10px] font-medium">Más</span>
        </button>
      </nav>
    </>
  );
}
