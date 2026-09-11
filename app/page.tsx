import { Suspense } from "react";
import { db } from "@/db";
import {
  apps,
  influencers,
  images,
  carousels,
  carouselSlides,
  clips,
  publisherUsers,
  tiktokAccounts,
  videos,
} from "@/db/schema";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Film,
  ImageIcon,
  Send,
  Smartphone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { DashboardSearch } from "@/components/dashboard-search";

export const dynamic = "force-dynamic";

type DashboardCarousel = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  archivedAt: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  sentAt: number | null;
  createdAt: number;
  appName: string | null;
  influencerName: string | null;
  publisherUsername: string | null;
  sentToAccountName: string | null;
  thumbnailPath: string | null;
};

function formatDate(timestamp: number | null) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });
}

function formatSchedule(date: string | null, time: string | null) {
  if (!date) return null;

  const parsed = new Date(`${date}T00:00:00`);
  const formatted = parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
  });

  return time ? `${formatted} · ${time}` : formatted;
}

function todayStr() {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function getCarouselState(c: DashboardCarousel) {
  if (c.archivedAt) {
    return {
      label: "Archivado",
      className:
        "bg-muted text-muted-foreground border-border",
    };
  }

  if (c.publishedAt) {
    return {
      label: "Publicado",
      className:
        "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
    };
  }

  if (c.sentAt) {
    return {
      label: "Draft",
      className:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    };
  }

  return {
    label: "Pendiente",
    className:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  };
}

function CarouselRow({ carousel }: { carousel: DashboardCarousel }) {
  const state = getCarouselState(carousel);
  const schedule = formatSchedule(carousel.scheduledDate, carousel.scheduledTime);
  const created = formatDate(carousel.createdAt);
  const meta = [carousel.influencerName, carousel.appName].filter(Boolean).join(" × ");

  return (
    <Link
      href={`/carousels/${carousel.id}`}
      className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 px-4 py-3 transition-colors hover:bg-muted/35 sm:grid-cols-[48px_72px_minmax(0,1fr)_160px_120px]"
    >
      <div className="h-16 w-11 overflow-hidden rounded-md border bg-muted sm:h-[70px] sm:w-12">
        {carousel.thumbnailPath ? (
          <img
            src={carousel.thumbnailPath}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
      </div>

      <div className="hidden items-center sm:flex">
        <span className="font-mono text-xl font-black leading-none tabular-nums">
          {carousel.shortId ?? "—"}
        </span>
      </div>

      <div className="min-w-0 self-center">
        <div className="mb-1 flex items-center gap-2 sm:hidden">
          <span className="font-mono text-lg font-black leading-none tabular-nums">
            {carousel.shortId ?? "—"}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${state.className}`}
          >
            {state.label}
          </span>
        </div>
        <p className="truncate text-sm font-semibold">{carousel.name}</p>
        {meta && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:hidden">
          {schedule && <span>{schedule}</span>}
          {carousel.publisherUsername && <span>@{carousel.publisherUsername}</span>}
          {carousel.sentToAccountName && <span>{carousel.sentToAccountName}</span>}
        </div>
      </div>

      <div className="hidden min-w-0 self-center text-xs text-muted-foreground sm:block">
        {schedule ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            {schedule}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            Creado {created}
          </span>
        )}
        {(carousel.publisherUsername || carousel.sentToAccountName) && (
          <p className="mt-1 truncate text-[11px]">
            {[carousel.publisherUsername && `@${carousel.publisherUsername}`, carousel.sentToAccountName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="hidden items-center justify-end sm:flex">
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight ${state.className}`}
        >
          {state.label}
        </span>
      </div>
    </Link>
  );
}

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
    [{ value: carouselCount }],
    [{ value: activeCount }],
    [{ value: sentCount }],
    [{ value: publishedCount }],
    [{ value: videoCount }],
    [{ value: clipCount }],
    recentRows,
  ] = await Promise.all([
    db.select({ value: count() }).from(apps),
    db.select({ value: count() }).from(influencers),
    db.select({ value: count() }).from(images),
    db.select({ value: count() }).from(carousels),
    db
      .select({ value: count() })
      .from(carousels)
      .where(and(isNull(carousels.archivedAt), isNull(carousels.publishedAt))),
    db
      .select({ value: count() })
      .from(carousels)
      .where(and(isNull(carousels.archivedAt), isNull(carousels.publishedAt), isNotNull(carousels.sentAt))),
    db
      .select({ value: count() })
      .from(carousels)
      .where(isNotNull(carousels.publishedAt)),
    db.select({ value: count() }).from(videos),
    db.select({ value: count() }).from(clips),
    db
      .select({
        id: carousels.id,
        name: carousels.name,
        shortId: carousels.shortId,
        status: carousels.status,
        archivedAt: carousels.archivedAt,
        scheduledDate: carousels.scheduledDate,
        scheduledTime: carousels.scheduledTime,
        publishedAt: carousels.publishedAt,
        sentAt: carousels.sentAt,
        createdAt: carousels.createdAt,
        appName: apps.name,
        influencerName: influencers.name,
        publisherUsername: publisherUsers.username,
        sentToAccountName: tiktokAccounts.name,
      })
      .from(carousels)
      .leftJoin(apps, eq(carousels.appId, apps.id))
      .leftJoin(influencers, eq(carousels.influencerId, influencers.id))
      .leftJoin(publisherUsers, eq(carousels.publisherUserId, publisherUsers.id))
      .leftJoin(tiktokAccounts, eq(carousels.sentToAccountId, tiktokAccounts.id))
      .orderBy(desc(carousels.createdAt))
      .limit(200),
  ]);

  const carouselIds = recentRows.map((c) => c.id);
  const firstSlides = carouselIds.length
    ? await db
        .select({
          carouselId: carouselSlides.carouselId,
          generatedImagePath: carouselSlides.generatedImagePath,
          imagePath: images.path,
        })
        .from(carouselSlides)
        .leftJoin(images, eq(carouselSlides.imageId, images.id))
        .where(inArray(carouselSlides.carouselId, carouselIds))
        .orderBy(asc(carouselSlides.order))
    : [];

  const thumbnailMap = new Map<string, string | null>();
  for (const slide of firstSlides) {
    if (!thumbnailMap.has(slide.carouselId)) {
      thumbnailMap.set(slide.carouselId, slide.generatedImagePath ?? slide.imagePath);
    }
  }

  const allCarousels: DashboardCarousel[] = recentRows.map((c) => ({
    ...c,
    thumbnailPath: thumbnailMap.get(c.id) ?? null,
  }));

  const filtered = q
    ? allCarousels.filter(
        (c) =>
          c.shortId === q ||
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.appName?.toLowerCase().includes(q.toLowerCase()) ||
          c.influencerName?.toLowerCase().includes(q.toLowerCase())
      )
    : allCarousels;

  const activeCarousels = filtered.filter((c) => !c.archivedAt && !c.publishedAt);
  const today = todayStr();
  const todayCarousels = activeCarousels.filter((c) => c.scheduledDate === today);
  const recentActiveCarousels = activeCarousels.filter((c) => c.scheduledDate !== today);
  const completedCarousels = filtered.filter((c) => c.archivedAt || c.publishedAt);

  const stats = [
    { label: "Hoy", value: todayCarousels.length, icon: CalendarClock, href: "/hoy" },
    { label: "Activos", value: activeCount, icon: Clock3, href: "/carousels" },
    { label: "Drafts", value: sentCount, icon: Send, href: "/carousels" },
    { label: "Publicados", value: publishedCount, icon: CheckCircle2, href: "/carousels" },
    { label: "Carousels", value: carouselCount, icon: Film, href: "/carousels" },
  ];

  return (
    <div className="space-y-6 pb-6 pt-4 md:pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vista rápida de los carousels recientes que siguen activos.
          </p>
        </div>
        <Suspense>
          <DashboardSearch defaultValue={q ?? ""} />
        </Suspense>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/apps"
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/35"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            Apps
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{appCount}</span>
        </Link>
        <Link
          href="/influencers"
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/35"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-muted-foreground" />
            Influencers
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{influencerCount}</span>
        </Link>
        <Link
          href="/images"
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/35"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            Imágenes
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{imageCount}</span>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/carousels"
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/35"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Film className="h-4 w-4 text-muted-foreground" />
            Carousels
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{carouselCount}</span>
        </Link>
        <Link
          href="/videos"
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/35"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clapperboard className="h-4 w-4 text-muted-foreground" />
            Videos
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{videoCount}</span>
        </Link>
        <Link
          href="/clips"
          className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 transition-colors hover:bg-muted/35"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clapperboard className="h-4 w-4 text-muted-foreground" />
            Clips
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">{clipCount}</span>
        </Link>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Hoy</CardTitle>
              <CardDescription>
                {q
                  ? `${todayCarousels.length} para hoy filtrado por "${q}"`
                  : `${todayCarousels.length} carousel${todayCarousels.length !== 1 ? "s" : ""} programado${todayCarousels.length !== 1 ? "s" : ""} para hoy`}
              </CardDescription>
            </div>
            <Link
              href="/hoy"
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Abrir Hoy
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {todayCarousels.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              {q ? <>Sin resultados para hoy con &quot;{q}&quot;.</> : <>Nada programado para hoy.</>}
            </p>
          ) : (
            <div className="divide-y">
              {todayCarousels.slice(0, 12).map((c) => (
                <CarouselRow key={c.id} carousel={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Activos recientes</CardTitle>
              <CardDescription>
                {q
                  ? `${recentActiveCarousels.length} activo${recentActiveCarousels.length !== 1 ? "s" : ""} reciente${recentActiveCarousels.length !== 1 ? "s" : ""} para "${q}"`
                  : `${recentActiveCarousels.length} activos recientes sin contar hoy`}
              </CardDescription>
            </div>
            <Link
              href="/carousels"
              className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Ver todos
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentActiveCarousels.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-8 text-center">
              {q ? (
                <>Sin resultados para &quot;{q}&quot;.</>
              ) : (
                <>No hay carousels. <Link href="/carousels" className="underline">Crea el primero.</Link></>
              )}
            </p>
          ) : (
            <div className="divide-y">
              {recentActiveCarousels.slice(0, 24).map((c) => (
                <CarouselRow key={c.id} carousel={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {completedCarousels.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Últimos cerrados</h2>
              <p className="text-xs text-muted-foreground">
                Publicados o archivados recientes, separados de los activos.
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {completedCarousels.length}
            </span>
          </div>
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {completedCarousels.slice(0, 8).map((c) => (
              <CarouselRow key={c.id} carousel={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
