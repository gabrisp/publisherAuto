"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";

type SentCarousel = {
  id: string;
  name: string;
  shortId: string | null;
  status: string;
  influencerName: string | null;
  appName: string | null;
  slideCount: number;
  sentAt: number | null;
  sentToAccountId: string | null;
  sentToAccountName: string | null;
  zipPath: string | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  generated: "default",
  edited: "outline",
};

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CarouselsPage() {
  const [all, setAll] = useState<SentCarousel[]>([]);
  const [filter, setFilter] = useState<"sent" | "all">("sent");

  useEffect(() => {
    fetch("/api/carousels?list=1")
      .then((r) => r.json())
      .then(setAll);
  }, []);

  const rows =
    filter === "sent" ? all.filter((c) => c.sentAt !== null) : all;

  const sentCount = all.filter((c) => c.sentAt !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carousels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sentCount} enviado{sentCount !== 1 ? "s" : ""} como draft · {all.length} total
          </p>
        </div>
        <Link href="/generate/review">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Review &amp; Upload
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setFilter("sent")}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
            filter === "sent"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Enviados ({sentCount})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
            filter === "all"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Todos ({all.length})
        </button>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {filter === "sent"
            ? "Ningún carousel enviado aún."
            : "No hay carousels."}{" "}
          <Link href="/generate/review" className="underline">
            Ir a Review &amp; Upload
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
            >
              {/* ShortId */}
              <div className="shrink-0 w-20 text-center">
                {c.shortId ? (
                  <code className="bg-primary/10 text-primary text-lg font-mono font-black px-2 py-1 rounded tracking-widest">
                    {c.shortId}
                  </code>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">
                    {c.name}
                  </span>
                  <Badge variant={STATUS_VARIANT[c.status] ?? "secondary"}>
                    {c.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[c.influencerName, c.appName].filter(Boolean).join(" × ")}{" "}
                  · {c.slideCount} slide{c.slideCount !== 1 ? "s" : ""}
                </div>
              </div>

              {/* TikTok account + date */}
              <div className="text-right shrink-0 min-w-[140px]">
                {c.sentToAccountName ? (
                  <div className="text-sm font-medium text-foreground">
                    @{c.sentToAccountName}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground italic">
                    No enviado
                  </div>
                )}
                {c.sentAt && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(c.sentAt)}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0">
                {c.zipPath && (
                  <a href={`/api/carousels/${c.id}/download`}>
                    <Button size="sm" variant="ghost" title="Descargar ZIP">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
