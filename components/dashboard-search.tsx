"use client";

import { useRouter } from "next/navigation";

export function DashboardSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();

  return (
    <input
      type="text"
      className="border rounded-md px-3 py-1.5 text-sm w-52 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="Buscar ID o nombre…"
      defaultValue={defaultValue}
      onChange={(e) => {
        const v = e.target.value.trim();
        router.push(v ? `/?q=${encodeURIComponent(v)}` : "/");
      }}
    />
  );
}
