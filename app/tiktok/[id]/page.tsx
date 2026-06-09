"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
  createdAt: number;
};

type CarouselItem = {
  id: string;
  name: string;
  shortId: string | null;
  sentAt: number | null;
  createdAt: number;
};

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function TikTokAccountPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [carousels, setCarousels] = useState<CarouselItem[]>([]);

  useEffect(() => {
    fetch(`/api/tiktok/accounts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAccount(d));
    fetch(`/api/carousels?list=1&sentToAccountId=${id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCarousels);
  }, [id]);

  if (!account) {
    return (
      <p className="text-sm text-muted-foreground pt-4">Cargando…</p>
    );
  }

  return (
    <div className="space-y-6 pt-4 md:pt-6 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/tiktok">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        {account.avatarUrl ? (
          <img
            src={account.avatarUrl}
            alt={account.name}
            className="h-10 w-10 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0">
            {account.name[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold leading-tight">@{account.name}</h1>
          <p className="text-xs text-muted-foreground">
            Conectado el {fmtDate(account.createdAt)}
          </p>
        </div>
      </div>

      {/* Carousels enviados */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Carousels enviados ({carousels.length})
        </h2>
        {carousels.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Ningún carousel enviado todavía.
          </p>
        ) : (
          <div className="space-y-1.5">
            {carousels.map((c) => (
              <Link key={c.id} href={`/carousels/${c.id}`}>
                <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 hover:shadow-sm transition-shadow cursor-pointer">
                  <span className="font-black font-mono text-lg w-12 shrink-0 leading-none">
                    {c.shortId ?? "—"}
                  </span>
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  {c.sentAt && (
                    <span className="text-[10px] bg-green-500/15 text-green-600 dark:text-green-400 rounded-full px-2 py-0.5 font-semibold shrink-0">
                      Enviado
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
