import { Suspense } from "react";
import { db } from "@/db";
import { apps, influencers, images, carousels } from "@/db/schema";
import { desc, count } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Smartphone, Users, ImageIcon, Zap } from "lucide-react";
import Link from "next/link";
import { DashboardSearch } from "@/components/dashboard-search";

const STATUS_COLOR: Record<string, string> = {
  draft: "secondary",
  generated: "default",
  edited: "outline",
};

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
    { label: "Images", value: imageCount, icon: ImageIcon, href: "/images" },
    { label: "Carousels", value: allCarousels.length, icon: Zap, href: "/generate" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Carousel History</CardTitle>
              <CardDescription>
                {q
                  ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""} para "${q}"`
                  : "All generated carousels — click any to edit"}
              </CardDescription>
            </div>
            <Suspense>
              <DashboardSearch defaultValue={q ?? ""} />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {q ? (
                <>No hay carousels con ese ID o nombre. <button onClick={() => {}} className="underline">Limpiar búsqueda</button></>
              ) : (
                <>No carousels yet. <Link href="/generate" className="underline">Generate your first one.</Link></>
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">ID</th>
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {c.shortId ? (
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            {c.shortId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-medium">{c.name}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_COLOR[c.status] as "default" | "secondary" | "outline"}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(c.createdAt * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-2 flex gap-2">
                        <Link
                          href={`/generate/${c.id}`}
                          className="text-xs underline text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </Link>
                        {c.zipPath && (
                          <a
                            href={`/api/carousels/${c.id}/download`}
                            className="text-xs underline text-muted-foreground hover:text-foreground"
                          >
                            ZIP
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
