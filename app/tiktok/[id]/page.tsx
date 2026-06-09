"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { CarouselGrid, type CarouselRow } from "@/components/carousel-grid";

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
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
  const [carousels, setCarousels] = useState<CarouselRow[]>([]);

  useEffect(() => {
    fetch(`/api/tiktok/accounts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAccount(d));
    fetch(`/api/carousels?sentToAccountId=${id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCarousels);
  }, [id]);

  if (!account) {
    return (
      <p className="text-sm text-muted-foreground pt-4">Cargando…</p>
    );
  }

  return (
    <div className="space-y-6 pt-4 md:pt-6">
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
      <div className="space-y-3 pb-6">
        <h2 className="text-sm font-semibold">
          Carousels enviados ({carousels.length})
        </h2>
        <CarouselGrid
          carousels={carousels}
          emptyText="Ningún carousel enviado todavía."
        />
      </div>
    </div>
  );
}
