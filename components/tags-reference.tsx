"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import type { TagsResponse } from "@/app/api/images/tags/route";

// Parse raw stored tag ("abs" or '["abs","mirror"]') → string[]
function parseRawTag(raw: string): string[] {
  if (raw.startsWith("[")) {
    try { return JSON.parse(raw) as string[]; } catch {}
  }
  return [raw];
}

// Display label: single tag → "abs", multi → "abs · mirror"
function tagLabel(raw: string): string {
  return parseRawTag(raw).join(" · ");
}

// Snippet to copy on chip click — always "tags": [...]
function tagSnippet(raw: string): string {
  return `"tags": ${JSON.stringify(parseRawTag(raw))}`;
}

function TagChip({ raw, scope }: { raw: string; scope: string }) {
  const tags = parseRawTag(raw);
  const snippet = tagSnippet(raw);

  function copy() {
    navigator.clipboard.writeText(snippet).then(() =>
      toast.success(`Copiado`)
    );
  }

  return (
    <button
      onClick={copy}
      title={snippet}
      className="inline-flex items-center gap-0.5 rounded-md border bg-muted/50 px-1.5 py-0.5 hover:bg-muted hover:border-primary/50 transition-colors cursor-copy"
    >
      {tags.map((t, i) => (
        <span key={i} className="text-xs font-mono">{t}{i < tags.length - 1 && <span className="text-muted-foreground mx-0.5">·</span>}</span>
      ))}
    </button>
  );
}

function buildCopyAllText(data: TagsResponse): string {
  const lines: string[] = ["=== TAGS DISPONIBLES ===", ""];

  if (data.global.length > 0) {
    lines.push("GLOBAL");
    lines.push(data.global.map(tagSnippet).join("  ·  "));
    lines.push("");
  }

  data.apps
    .filter((a) => a.tags.length > 0)
    .forEach((app) => {
      lines.push(`APP · ${app.name}  →  "app": "${app.slug}"`);
      lines.push(app.tags.map(tagSnippet).join("  ·  "));
      lines.push("");
    });

  data.influencers
    .filter((i) => i.tags.length > 0)
    .forEach((inf) => {
      lines.push(`INFLUENCER · ${inf.name}  →  "influencer": "${inf.slug}"`);
      lines.push(inf.tags.map(tagSnippet).join("  ·  "));
      lines.push("");
    });

  return lines.join("\n").trim();
}

export function TagsReference({ onRefresh }: { onRefresh?: number }) {
  const [data, setData] = useState<TagsResponse | null>(null);

  async function load() {
    const res = await fetch("/api/images/tags");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => { load(); }, [onRefresh]);

  if (!data) return <p className="text-xs text-muted-foreground">Cargando tags…</p>;

  const isEmpty =
    data.global.length === 0 &&
    data.apps.every((a) => a.tags.length === 0) &&
    data.influencers.every((i) => i.tags.length === 0);

  if (isEmpty) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No hay tags todavía. Sube imágenes primero.
      </p>
    );
  }

  function copyAll() {
    navigator.clipboard.writeText(buildCopyAllText(data!)).then(() =>
      toast.success("Todos los tags copiados")
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Clic en un tag para copiar su snippet JSON · o copia todo de golpe
        </p>
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1 hover:bg-muted transition-colors"
        >
          <Copy className="h-3 w-3" />
          Copy all
        </button>
      </div>

      {/* Global */}
      {data.global.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Global
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.global.map((tag) => (
              <TagChip key={tag} raw={tag} scope="global" />
            ))}
          </div>
        </section>
      )}

      {/* Apps */}
      {data.apps.filter((a) => a.tags.length > 0).map((app) => (
        <section key={app.id}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            App · {app.name}
            <span className="ml-1 font-mono font-normal normal-case opacity-60">
              ({app.slug})
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {app.tags.map((tag) => (
              <TagChip key={tag} raw={tag} scope="app" />
            ))}
          </div>
        </section>
      ))}

      {/* Influencers */}
      {data.influencers.filter((i) => i.tags.length > 0).map((inf) => (
        <section key={inf.id}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Influencer · {inf.name}
            <span className="ml-1 font-mono font-normal normal-case opacity-60">
              ({inf.slug})
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {inf.tags.map((tag) => (
              <TagChip key={tag} raw={tag} scope="influencer" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
