import { Suspense } from "react";
import { db } from "@/db";
import { apps, influencers, images, carousels } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Smartphone, Users, ImageIcon, Film } from "lucide-react";
import Link from "next/link";
import { DashboardSearch } from "@/components/dashboard-search";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const [
    [{ value: appCount }],
    [{ value: influencerCount }],
    [{ value: imageCount }],
    allCarousels,
  ] = await Promise.all([
    db.select({ value: count() }).from(apps),
    db.select({ value: count() }).from(influencers),
    db.select({ value: count() }).from(images),
    db.select().from(carousels).orderBy(desc(carousels.createdAt)).limit(200),
  ]);

  const filtered = q
    ? allCarousels.filter(
        (c) =>
          c.shortId === q ||
          c.name.toLowerCase().includes(q.toLowerCase())
      )
    : allCarousels;

  const stats = [
    { label: "Apps", value: appCount, icon: Smartphone, href: "/apps" },
    { label: "Influencers", value: influencerCount, icon: Users, href: "/influencers" },
    { label: "Imágenes", value: imageCount, icon: ImageIcon, href: "/images" },
    { label: "Carousels", value: allCarousels.length, icon: Film, href: "/carousels" },
  ];

  return (
    <div className="space-y-6 pt-4 md:pt-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-3xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Carousel list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Carousels</CardTitle>
              <CardDescription>
                {q
                  ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""} para "${q}"`
                  : `${allCarousels.length} carousels en total`}
              </CardDescription>
            </div>
            <Suspense>
              <DashboardSearch defaultValue={q ?? ""} />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              {q ? (
                <>Sin resultados para &quot;{q}&quot;.</>
              ) : (
                <>No hay carousels. <Link href="/generate" className="underline">Genera el primero.</Link></>
              )}
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => {
                const isSent = !!c.sentAt;
                return (
                  <Link
                    key={c.id}
                    href={`/carousels/${c.id}`}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors first:rounded-t-none last:rounded-b-xl"
                  >
                    {/* ShortId */}
                    <span className="font-mono font-black text-lg w-12 shrink-0 leading-none tabular-nums">
                      {c.shortId ?? "—"}
                    </span>

                    {/* Name */}
                    <p className="flex-1 text-sm font-medium truncate min-w-0">{c.name}</p>

                    {/* Date */}
                    <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
                      {new Date(c.createdAt * 1000).toLocaleDateString("es-ES", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </span>

                    {/* Status pill */}
                    {isSent ? (
                      <span className="shrink-0 text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold leading-tight">
                        Enviado
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium leading-tight">
                        Pendiente
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
