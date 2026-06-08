import { randomUUID } from "crypto";

export const newId = () => randomUUID();
export const now = () => Math.floor(Date.now() / 1000);

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generates a 4-digit numeric ID (1000–9999) used as the reference slide shown in TikTok drafts. */
export function generateShortId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Parse the `tag` column value into an array of tags.
 * Supports:
 *   - JSON arrays:          '["biceps","arm"]'        → ["biceps", "arm"]
 *   - underscore-separated: "girl-to-men_break-up_2" → ["girl-to-men", "break-up"]
 *   - plain single string:  "biceps"                 → ["biceps"]
 *
 * Pure-numeric segments (e.g. trailing counters like "_2") are ignored.
 */
export function parseTags(raw: string): string[] {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try {
      return (JSON.parse(raw) as string[])
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0 && !/^\d+$/.test(t));
    } catch {}
  }
  // underscore separates tags; hyphens are part of the tag name; pure numbers are counters
  return raw
    .split("_")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && !/^\d+$/.test(t));
}

/** Serialize an array of tags for storage in the `tag` column. */
export function serializeTags(tags: string[]): string {
  const clean = tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 3);
  return clean.length === 1 ? clean[0] : JSON.stringify(clean);
}
