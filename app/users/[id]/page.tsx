"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Eye, EyeOff, Film, CheckCircle2, Clock, MonitorSmartphone } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type Carousel = {
  id: string;
  name: string;
  status: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: number | null;
  stats: string | null;
  videoTitle: string | null;
  archivedAt: number | null;
};

type Account = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type UserDetail = {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: number;
  carousels: Carousel[];
  accounts: Account[];
  today: string;
};

type TiktokAccount = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [allAccounts, setAllAccounts] = useState<TiktokAccount[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function load() {
    const [userRes, accountsRes] = await Promise.all([
      fetch(`/api/users/${id}`),
      fetch("/api/tiktok/accounts"),
    ]);
    if (userRes.ok) setUser(await userRes.json());
    if (accountsRes.ok) setAllAccounts(await accountsRes.json());
  }

  useEffect(() => { load(); }, [id]);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) throw new Error();
      toast.success("Contraseña actualizada");
      setNewPassword("");
    } catch {
      toast.error("Error al actualizar contraseña");
    } finally {
      setSavingPassword(false);
    }
  }

  async function toggleAccount(accountId: string, assigned: boolean) {
    const method = assigned ? "DELETE" : "POST";
    const res = await fetch(`/api/users/${id}/accounts`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (res.ok) {
      toast.success(assigned ? "Cuenta desasignada" : "Cuenta asignada");
      load();
    } else {
      toast.error("Error al actualizar cuentas");
    }
  }

  if (!user) return <p className="text-sm text-muted-foreground pt-6">Cargando…</p>;

  const today = user.today;
  const assignedAccountIds = new Set(user.accounts.map((a) => a.id));

  const todayCarousels = user.carousels.filter(
    (c) => c.scheduledDate === today && c.status !== "published"
  );
  const upcomingCarousels = user.carousels.filter(
    (c) => c.scheduledDate && c.scheduledDate > today && c.status !== "published"
  );
  const publishedCarousels = user.carousels.filter((c) => c.status === "published");

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  function CarouselRow({ c }: { c: Carousel }) {
    return (
      <Link
        href={`/carousels/${c.id}`}
        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors text-sm"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{c.videoTitle || c.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(c.scheduledDate)}
            {c.scheduledTime && ` · ${c.scheduledTime}`}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {c.status === "published" && (
            <Badge variant="secondary" className="text-xs">Publicado</Badge>
          )}
          {c.status === "published" && !c.stats && (
            <Badge variant="destructive" className="text-xs">Sin stats</Badge>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-6 pt-4 md:pt-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/users">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">@{user.username}</h1>
          {user.displayName && (
            <p className="text-sm text-muted-foreground">{user.displayName}</p>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-lg border p-4">
        <p className="text-sm font-medium mb-3">Cambiar contraseña</p>
        <form onSubmit={handlePasswordChange} className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              className="pr-10"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" disabled={savingPassword || !newPassword.trim()} size="sm">
            Guardar
          </Button>
        </form>
      </div>

      <Tabs defaultValue="hoy">
        <TabsList className="w-full">
          <TabsTrigger value="hoy" className="flex-1 gap-1.5">
            <Film className="h-3.5 w-3.5" />
            Hoy
            {todayCarousels.length > 0 && (
              <Badge className="h-4 text-[10px] px-1">{todayCarousels.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="proximos" className="flex-1 gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Próximos
            {upcomingCarousels.length > 0 && (
              <Badge variant="secondary" className="h-4 text-[10px] px-1">{upcomingCarousels.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="publicados" className="flex-1 gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Publicados
          </TabsTrigger>
          <TabsTrigger value="cuentas" className="flex-1 gap-1.5">
            <MonitorSmartphone className="h-3.5 w-3.5" />
            Cuentas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoy" className="space-y-2 mt-4">
          {todayCarousels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Ningún carousel para hoy.</p>
          ) : (
            todayCarousels.map((c) => <CarouselRow key={c.id} c={c} />)
          )}
        </TabsContent>

        <TabsContent value="proximos" className="space-y-2 mt-4">
          {upcomingCarousels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sin carousels próximos.</p>
          ) : (
            upcomingCarousels.map((c) => <CarouselRow key={c.id} c={c} />)
          )}
        </TabsContent>

        <TabsContent value="publicados" className="space-y-2 mt-4">
          {publishedCarousels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Ningún carousel publicado aún.</p>
          ) : (
            publishedCarousels.map((c) => <CarouselRow key={c.id} c={c} />)
          )}
        </TabsContent>

        <TabsContent value="cuentas" className="space-y-2 mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            Selecciona las cuentas de TikTok a las que este usuario tiene acceso.
          </p>
          {allAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay cuentas de TikTok configuradas.{" "}
              <Link href="/tiktok" className="underline">Añadir cuentas</Link>
            </p>
          ) : (
            allAccounts.map((account) => {
              const assigned = assignedAccountIds.has(account.id);
              return (
                <div
                  key={account.id}
                  className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleAccount(account.id, assigned)}
                >
                  <Checkbox
                    checked={assigned}
                    onCheckedChange={() => toggleAccount(account.id, assigned)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {account.avatarUrl ? (
                    <img
                      src={account.avatarUrl}
                      alt={account.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {account.name[0]}
                    </div>
                  )}
                  <span className="text-sm font-medium">{account.name}</span>
                  {assigned && (
                    <Badge variant="secondary" className="ml-auto text-xs">Asignada</Badge>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
