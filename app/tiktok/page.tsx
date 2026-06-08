"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

function OAuthNotifier() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("connected")) toast.success("Cuenta conectada correctamente");
    if (searchParams.get("error")) toast.error(`Error: ${decodeURIComponent(searchParams.get("error")!)}`);
  }, []);
  return null;
}

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export default function TikTokPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  async function load() {
    const res = await fetch("/api/tiktok/accounts");
    if (res.ok) setAccounts(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleDisconnect(id: string, name: string) {
    if (!confirm(`¿Desconectar @${name}?`)) return;
    await fetch(`/api/tiktok/accounts/${id}`, { method: "DELETE" });
    toast.success("Cuenta desconectada");
    load();
  }

  return (
    <div className="space-y-6 max-w-md pt-4 md:pt-6">
      <Suspense><OAuthNotifier /></Suspense>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">TikTok</h1>
        <a href="/api/tiktok/auth">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Conectar cuenta
          </Button>
        </a>
      </div>

      <div className="divide-y rounded-xl border overflow-hidden">
        {accounts.map((acc) => (
          <div key={acc.id} className="flex items-center gap-3 px-4 py-3 bg-card">
            {acc.avatarUrl ? (
              <img src={acc.avatarUrl} alt={acc.name}
                className="h-9 w-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                {acc.name[0]?.toUpperCase()}
              </div>
            )}
            <span className="flex-1 font-medium text-sm">@{acc.name}</span>
            <button
              onClick={() => handleDisconnect(acc.id, acc.name)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">
            No hay cuentas conectadas.
          </p>
        )}
      </div>
    </div>
  );
}
