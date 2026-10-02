export function formatMoney(value: number | null | undefined): string {
  const n = Number(value || 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("ru-RU").format(Number(value || 0));
}

export function formatPct(value: number | null | undefined): string {
  const n = Number(value || 0);
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}%`;
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
