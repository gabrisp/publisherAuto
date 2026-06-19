"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export default function TikTokPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/tiktok/accounts");
    if (res.ok) setAccounts(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tiktok/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success("Cuenta añadida");
      setName("");
      setAvatarUrl("");
      setAdding(false);
      load();
    } catch {
      toast.error("Error al añadir cuenta");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, accountName: string) {
    if (!confirm(`¿Eliminar @${accountName}?`)) return;
    await fetch(`/api/tiktok/accounts/${id}`, { method: "DELETE" });
    toast.success("Cuenta eliminada");
    load();
  }

  return (
    <div className="space-y-6 max-w-md pt-4 md:pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cuentas TikTok</h1>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {adding ? "Cancelar" : "Añadir"}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="rounded-xl border p-4 space-y-3 bg-muted/20">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre / handle</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="@cuenta"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">URL avatar (opcional)</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Añadir cuenta"}
          </button>
        </form>
      )}

      <div className="divide-y rounded-xl border overflow-hidden">
        {accounts.map((acc) => (
          <Link key={acc.id} href={`/tiktok/${acc.id}`}
            className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-colors cursor-pointer">
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
              onClick={(e) => { e.preventDefault(); handleDelete(acc.id, acc.name); }}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </Link>
        ))}
        {accounts.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground px-4 py-8 text-center">
            No hay cuentas. Añade la primera.
          </p>
        )}
      </div>
    </div>
  );
}
