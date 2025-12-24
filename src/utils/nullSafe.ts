export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function safeLower(v: unknown): string {
  if (typeof v !== "string") return "";
  const trimmed = v.trim();
  return trimmed ? trimmed.toLowerCase() : "";
}

export function safeNumber(v: unknown, fallback: number = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}
