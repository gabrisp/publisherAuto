"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function DashboardSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const v = value.trim();
      if (v === defaultValue.trim()) return;
      router.replace(v ? `/?q=${encodeURIComponent(v)}` : "/");
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [defaultValue, router, value]);

  return (
    <input
      type="text"
      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
      placeholder="Buscar ID o nombre…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
