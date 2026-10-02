declare global {
  interface Window {
    ym?: ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  }
}

/** Replace with real counter id before production deploy. */
export const METRIKA_ID = 0;

export function trackGoal(name: string, params?: Record<string, string | number>): void {
  if (!METRIKA_ID || typeof window.ym !== "function") {
    console.debug("[metrika]", name, params ?? {});
    return;
  }
  window.ym(METRIKA_ID, "reachGoal", name, params);
}

export function initMetrika(): void {
  if (!METRIKA_ID) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";
  document.head.appendChild(script);

  const ym = function (...args: unknown[]) {
    (ym.a = ym.a || []).push(args);
  } as ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  ym.l = Date.now();
  window.ym = ym;
  window.ym(METRIKA_ID, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });
}

export {};
