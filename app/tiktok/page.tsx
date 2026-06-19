"use client";

import { useState, useEffect } from "react";
import { Trash2, Plus, Music2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export default function TikTokPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus /> Añadir cuenta
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva cuenta TikTok</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="acc-name">Nombre / handle</Label>
                <Input
                  id="acc-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="@cuenta"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-avatar">URL avatar <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="acc-avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!name.trim() || saving} className="w-full">
                  {saving ? "Guardando…" : "Añadir cuenta"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="divide-y rounded-xl border overflow-hidden">
        {accounts.map((acc) => (
          <Link
            key={acc.id}
            href={`/tiktok/${acc.id}`}
            className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
          >
            {acc.avatarUrl ? (
              <img src={acc.avatarUrl} alt={acc.name} className="h-9 w-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                {acc.name[0]?.toUpperCase()}
              </div>
            )}
            <span className="flex-1 font-medium text-sm">@{acc.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.preventDefault(); handleDelete(acc.id, acc.name); }}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Link>
        ))}
        {accounts.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Music2 className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay cuentas. Añade la primera.</p>
          </div>
        )}
      </div>
    </div>
  );
}
