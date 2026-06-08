"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, CheckCircle, ChevronDown, ChevronUp, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

/** Reads ?connected and ?error from the URL and fires toasts — must be in Suspense */
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
  tiktokUserId: string;
  avatarUrl: string | null;
  createdAt: number;
};

type TiktokConfig = {
  clientKey: string;
  clientSecretSet: boolean;
  redirectUri: string;
  publicBaseUrl: string;
  envConfigured: boolean;
};

export default function TikTokPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [config, setConfig] = useState<TiktokConfig | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [clientKey, setClientKey] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  // Manual token form
  const [manualHandle, setManualHandle] = useState("");
  const [manualOpenId, setManualOpenId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualRefreshToken, setManualRefreshToken] = useState("");
  const [manualExpiresIn, setManualExpiresIn] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showRefreshToken, setShowRefreshToken] = useState(false);

  async function loadAccounts() {
    const res = await fetch("/api/tiktok/accounts");
    if (res.ok) setAccounts(await res.json());
  }

  async function loadConfig() {
    const res = await fetch("/api/settings/tiktok");
    if (res.ok) {
      const data: TiktokConfig = await res.json();
      setConfig(data);
      setClientKey(data.clientKey);
      setRedirectUri(data.redirectUri || "http://localhost:3000/api/tiktok/callback");
      setPublicBaseUrl(data.publicBaseUrl || "");
    }
  }

  useEffect(() => {
    loadAccounts();
    loadConfig();
  }, []);

  async function handleSaveCredentials() {
    setSaving(true);
    try {
      const body: Record<string, string> = {
        clientKey,
        redirectUri,
        publicBaseUrl,
      };
      if (clientSecret.trim()) body.clientSecret = clientSecret;

      const res = await fetch("/api/settings/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success("Credenciales guardadas");
      setClientSecret(""); // clear after save
      await loadConfig();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearCredentials() {
    if (!confirm("¿Borrar las credenciales guardadas?")) return;
    await fetch("/api/settings/tiktok", { method: "DELETE" });
    toast.success("Credenciales borradas");
    setClientKey("");
    setClientSecret("");
    setRedirectUri("http://localhost:3000/api/tiktok/callback");
    await loadConfig();
  }

  async function handleAddManual() {
    if (!manualHandle.trim() || !manualToken.trim()) {
      toast.error("Rellena el handle y el access token");
      return;
    }
    setAddingManual(true);
    try {
      const res = await fetch("/api/tiktok/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: manualHandle.trim().replace(/^@/, ""),
          openId: manualOpenId.trim() || undefined,
          accessToken: manualToken.trim(),
          refreshToken: manualRefreshToken.trim() || undefined,
          expiresIn: manualExpiresIn.trim() ? Number(manualExpiresIn.trim()) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(`Error: ${err.error}`);
      } else {
        toast.success("Cuenta añadida");
        setManualHandle("");
        setManualOpenId("");
        setManualToken("");
        setManualRefreshToken("");
        setManualExpiresIn("");
        loadAccounts();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setAddingManual(false);
    }
  }

  async function handleDisconnect(id: string, name: string) {
    if (!confirm(`¿Desconectar @${name}?`)) return;
    await fetch(`/api/tiktok/accounts/${id}`, { method: "DELETE" });
    toast.success("Cuenta desconectada");
    loadAccounts();
  }

  const credentialsConfigured =
    config?.envConfigured ||
    (config?.clientKey && config?.clientSecretSet);

  return (
    <div className="space-y-6 max-w-2xl">
      <Suspense><OAuthNotifier /></Suspense>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cuentas TikTok</h1>
        <a href="/api/tiktok/auth">
          <Button disabled={!credentialsConfigured}>
            <Plus className="h-4 w-4 mr-2" />
            Conectar cuenta
          </Button>
        </a>
      </div>

      {/* Credentials card */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none pb-3"
          onClick={() => setShowCredentials((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Credenciales de API
                {credentialsConfigured ? (
                  <Badge variant="default" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" /> Configurado
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Sin configurar</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {config?.envConfigured
                  ? "Leyendo desde variables de entorno (.env.local)"
                  : "Introduce tu Client Key y Client Secret de developers.tiktok.com"}
              </CardDescription>
            </div>
            {showCredentials ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>

        {showCredentials && (
          <CardContent className="space-y-3 pt-0">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Client Key
              </label>
              <input
                type="text"
                value={clientKey}
                onChange={(e) => setClientKey(e.target.value)}
                placeholder="aw1234567890abcdef"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Client Secret
                {config?.clientSecretSet && (
                  <span className="ml-2 text-green-600 dark:text-green-400 font-normal">
                    (ya guardado — deja vacío para no cambiar)
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={config?.clientSecretSet ? "••••••••••••" : "Tu client secret"}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Redirect URI
              </label>
              <input
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                placeholder="http://localhost:3000/api/tiktok/callback"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Añade esta URI en tu app de developers.tiktok.com como redirect URI autorizada.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                URL pública del servidor
              </label>
              <input
                type="text"
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://xxxx.ngrok-free.app"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                TikTok necesita descargar las imágenes desde una URL pública. Usa ngrok, Cloudflare Tunnel o tu dominio.
                También puedes definir <code className="font-mono">PUBLIC_BASE_URL</code> en <code className="font-mono">.env.local</code>.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSaveCredentials} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Guardando…" : "Guardar"}
              </Button>
              {(config?.clientKey || config?.clientSecretSet) && (
                <Button size="sm" variant="ghost" onClick={handleClearCredentials}
                  className="text-destructive hover:text-destructive">
                  Borrar credenciales
                </Button>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Manual token form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Añadir cuenta con token</CardTitle>
          <CardDescription>
            Pega los datos del token directamente — sin OAuth. Copia los valores del JSON de respuesta de TikTok.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Row 1: handle + open_id */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">Handle / nombre</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                <input
                  type="text"
                  value={manualHandle}
                  onChange={(e) => setManualHandle(e.target.value.replace(/^@/, ""))}
                  placeholder="username"
                  className="w-full border rounded-md pl-7 pr-3 py-2 text-sm bg-background"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">open_id <span className="opacity-50">(opcional)</span></label>
              <input
                type="text"
                value={manualOpenId}
                onChange={(e) => setManualOpenId(e.target.value)}
                placeholder="MS4wLjABAAAA…"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
              />
            </div>
          </div>

          {/* Row 2: access_token */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">access_token</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="act.xxxxxxxxxxxxxxxx…"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono pr-10"
              />
              <button type="button" onClick={() => setShowToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Row 3: refresh_token */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">refresh_token <span className="opacity-50">(opcional)</span></label>
            <div className="relative">
              <input
                type={showRefreshToken ? "text" : "password"}
                value={manualRefreshToken}
                onChange={(e) => setManualRefreshToken(e.target.value)}
                placeholder="rft.xxxxxxxxxxxxxxxx…"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono pr-10"
              />
              <button type="button" onClick={() => setShowRefreshToken((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showRefreshToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Row 4: expires_in + button */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">expires_in <span className="opacity-50">(segundos, opcional)</span></label>
              <input
                type="number"
                value={manualExpiresIn}
                onChange={(e) => setManualExpiresIn(e.target.value)}
                placeholder="86400"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono"
              />
            </div>
            <Button
              onClick={handleAddManual}
              disabled={addingManual || !manualHandle.trim() || !manualToken.trim()}
              className="shrink-0 mb-0.5"
            >
              {addingManual ? "…" : "Añadir cuenta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts list */}
      <div className="space-y-2">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              {acc.avatarUrl ? (
                <img src={acc.avatarUrl} alt={acc.name}
                  className="h-10 w-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                  {acc.name[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium">{acc.name}</p>
                <p className="text-xs text-muted-foreground">{acc.tiktokUserId}</p>
              </div>
              <Badge variant="default" className="ml-2">
                <CheckCircle className="h-3 w-3 mr-1" /> Conectada
              </Badge>
            </div>
            <button
              onClick={() => handleDisconnect(acc.id, acc.name)}
              className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {accounts.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            {credentialsConfigured
              ? "No hay cuentas conectadas. Pulsa \"Conectar cuenta\" arriba."
              : "Configura las credenciales primero para poder conectar cuentas."}
          </p>
        )}
      </div>
    </div>
  );
}
