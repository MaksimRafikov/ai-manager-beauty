import type { DemoPayload, DashboardSlice } from "./types";

let cache: DemoPayload | null = null;

export async function loadDemoData(): Promise<DemoPayload> {
  if (cache) return cache;
  const res = await fetch("/data/demo-dashboard.json");
  if (!res.ok) {
    throw new Error(`Не удалось загрузить демо-данные (${res.status})`);
  }
  cache = (await res.json()) as DemoPayload;
  return cache;
}

export function getSlice(
  payload: DemoPayload,
  branchKey: string,
  periodKey: string,
): DashboardSlice {
  const key = `${branchKey}::${periodKey}`;
  const slice = payload.slices[key];
  if (!slice) {
    const fallback = `${payload.filters.default_branch}::${payload.filters.default_period}`;
    return payload.slices[fallback];
  }
  return slice;
}
