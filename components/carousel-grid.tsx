"use client";

import { useRouter } from "next/navigation";

/* ── Types (shared with entity pages) ───────────────────────────────── */
export type CarouselSlide = {
  id: string;
  order: number;
  generatedImagePath: string | null;
  imagePath: string | null;
};

export type CarouselRow = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  zipPath: string | null;
  appName: string | null;
  influencerName: string | null;
  sentAt: number | null;
  sentToAccountName: string | null;
  slideCount: number;
  slides: CarouselSlide[];
};

/* ── Sub-components ─────────────────────────────────────────────────── */
function SlideThumbs({ slides }: { slides: CarouselSlide[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto shrink-0" style={{ scrollbarWidth: "none" }}>
      {slides.length > 0 ? (
        slides.map((slide) => {
          const src = slide.generatedImagePath ?? slide.imagePath;
          return (
            <div
              key={slide.id}
              className="shrink-0 rounded-md overflow-hidden bg-muted"
              style={{ width: 54, height: 96 }}
            >
              {src ? (
                <img src={src} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted/50" />
              )}
            </div>
          );
        })
      ) : (
        <div
          className="rounded-md bg-muted/50 flex items-center justify-center text-[10px] text-muted-foreground"
          style={{ width: 54, height: 96 }}
        >
          –
        </div>
      )}
    </div>
  );
}

function SentPill() {
  return (
    <span className="shrink-0 text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold leading-tight">
      Enviado
    </span>
  );
}

function CarouselGridCard({
  c,
  onClick,
}: {
  c: CarouselRow;
  onClick: () => void;
}) {
  const isSent = !!c.sentAt;
  return (
    <div
      role="button"
      tabIndex={0}
      className="relative flex flex-col rounded-2xl border bg-card overflow-hidden transition-all cursor-pointer hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-foreground/20"
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Slides strip */}
      <div className="p-2 pt-4 bg-muted/20">
        <SlideThumbs slides={c.slides} />
      </div>

      {/* Footer */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-2xl font-black font-mono leading-none tracking-wide">
            {c.shortId ?? "—"}
          </span>
          {isSent && <SentPill />}
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug truncate">{c.name}</p>
        <div className="text-[11px] text-muted-foreground leading-snug">
          {c.sentToAccountName && (
            <span className="font-medium text-foreground">@{c.sentToAccountName}</span>
          )}
          {c.sentToAccountName && (c.appName || c.influencerName) && " · "}
          {[c.influencerName, c.appName].filter(Boolean).join(" × ")}
        </div>
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */
export function CarouselGrid({
  carousels,
  emptyText = "Ningún carousel todavía.",
}: {
  carousels: CarouselRow[];
  emptyText?: string;
}) {
  const router = useRouter();

  if (carousels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {carousels.map((c) => (
        <CarouselGridCard
          key={c.id}
          c={c}
          onClick={() => router.push(`/carousels/${c.id}`)}
        />
      ))}
    </div>
  );
}
