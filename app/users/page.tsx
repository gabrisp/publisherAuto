"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, ChevronRight, UserCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type PublisherUser = {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: number;
  carouselCount: number;
  accountCount: number;
};

export default function UsersPage() {
  const [users, setUsers] = useState<PublisherUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error al crear usuario");
        return;
      }
      toast.success(`Usuario @${username} creado`);
      setUsername("");
      setPassword("");
      setDisplayName("");
      load();
    } catch {
      toast.error("Error de red");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(user: PublisherUser, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`¿Eliminar usuario @${user.username}? Esta acción es irreversible.`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Usuario eliminado");
      load();
    } else {
      toast.error("Error al eliminar");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl pt-4 md:pt-6">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Nuevo usuario</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="username"
                className="flex-1"
                autoComplete="off"
              />
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nombre (opcional)"
                className="flex-1"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
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
              <Button
                type="submit"
                disabled={creating || !username.trim() || !password.trim()}
              >
                <Plus className="h-4 w-4 mr-1" /> Crear
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/users/${user.id}`}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">@{user.username}</p>
                {user.displayName && (
                  <p className="text-xs text-muted-foreground">{user.displayName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-muted-foreground">
                  {user.carouselCount} carousels · {user.accountCount} cuentas
                </p>
              </div>
              <button
                onClick={(e) => handleDelete(user, e)}
                className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            Aún no hay usuarios. Crea uno arriba.
          </p>
        )}
      </div>
    </div>
  );
}
