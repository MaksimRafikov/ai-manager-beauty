import type { DemoPayload, DashboardSlice, MoreNav, OverviewTab, PrimaryNav } from "./types";
import { getSlice } from "./data";
import { escapeHtml, formatMoney, formatNumber, formatPct } from "./format";
import { disposeCharts, renderAdsBars, renderSegmentPies, resizeCharts } from "./charts";
import { downloadCallListExcel, downloadPrepayExcel } from "./excel";
import { trackGoal } from "./metrika";

export type DashboardState = {
  branch: string;
  period: string;
  draftBranch: string;
  draftPeriod: string;
  primary: PrimaryNav;
  overviewTab: OverviewTab;
  more: MoreNav;
};

export type DashboardHooks = {
  onApply: () => void;
  onSegmentClick: (name: string) => void;
  onExcel: () => void;
};

const SEGMENT_CALL_LISTS: Record<string, string> = {
  Уходят: "list-ukhodyat",
  Ядро: "list-yadro",
  Новички: "list-novichki",
};

const SEGMENT_NO_LIST_NOTES: Record<string, string> = {
  Растут:
    "«Растут» уже ходят сами — отдельного списка на обзвон нет. Звоним по спискам «Уходят», «Ядро без будущей записи» и «Новички».",
  Спящие:
    "«Спящим» не звоним: на них не тратим время администратора и бюджет.",
};

function focusCallList(root: HTMLElement, listId: string): void {
  const block = root.querySelector<HTMLElement>(`#${listId}`);
  if (!block) return;
  block.classList.add("is-focused");
  // The guided tour positions its own highlight; scrolling under it shifts the stage.
  if (!document.body.classList.contains("driver-active")) {
    block.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function initialState(payload: DemoPayload): DashboardState {
  return {
    branch: payload.filters.default_branch,
    period: payload.filters.default_period,
    draftBranch: payload.filters.default_branch,
    draftPeriod: payload.filters.default_period,
    primary: "overview",
    overviewTab: "summary",
    more: "none",
  };
}

function kpiCard(label: string, value: string, hint?: string): string {
  return `<div class="kpi-card">
    <div class="kpi-label">${escapeHtml(label)}</div>
    <div class="kpi-value">${escapeHtml(value)}</div>
    ${hint ? `<div class="kpi-hint">${escapeHtml(hint)}</div>` : ""}
  </div>`;
}

function callTable(rows: DashboardSlice["call_lists"]["ukhodyat"], empty: string): string {
  if (!rows.length) return `<p class="muted">${escapeHtml(empty)}</p>`;
  return `<div class="table-wrap">
    <table class="data-table">
      <thead><tr>
        <th>№</th><th>Клиент</th><th>Телефон</th><th>Выручка</th><th>Дней</th><th>Филиал</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
            <td>${r.no ?? ""}</td>
            <td>${escapeHtml(r.client_name)}</td>
            <td>${escapeHtml(r.phone_fmt)}</td>
            <td>${formatMoney(r.monetary)}</td>
            <td>${r.recency_days ?? "—"}</td>
            <td>${escapeHtml(r.branches ?? "")}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>
  <div class="card-list">
    ${rows
      .map(
        (r) => `<article class="mini-card">
        <strong>${escapeHtml(r.client_name)}</strong>
        <span>${escapeHtml(r.phone_fmt)}</span>
        <span>${formatMoney(r.monetary)} · ${r.recency_days ?? "—"} дн.</span>
      </article>`,
      )
      .join("")}
  </div>`;
}

function formatDemoAnchor(iso?: string): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function renderDashboardShell(payload: DemoPayload, state: DashboardState): string {
  const slice = getSlice(payload, state.branch, state.period);
  const branchOpts = payload.filters.branches
    .map(
      (b) =>
        `<option value="${escapeHtml(b.key)}" ${b.key === state.draftBranch ? "selected" : ""}>${escapeHtml(b.label)}</option>`,
    )
    .join("");
  const periodOpts = payload.filters.periods
    .map(
      (p) =>
        `<option value="${escapeHtml(p.key)}" ${p.key === state.draftPeriod ? "selected" : ""}>${escapeHtml(p.label)}</option>`,
    )
    .join("");
  const anchorLabel = formatDemoAnchor(payload.meta.anchor_date);
  const demoPill = anchorLabel
    ? `демо · срез на ${anchorLabel}`
    : "пример салона · демо-данные";

  return `
  <div class="demo-window" id="demo-app">
    <div class="demo-titlebar">
      <div>
        <strong>${escapeHtml(payload.meta.salon_name)}</strong>
        <span class="demo-city">${escapeHtml(payload.meta.city)}</span>
      </div>
      <span class="demo-pill">${escapeHtml(demoPill)}</span>
    </div>
    <div class="demo-shell">
      <aside class="demo-sidebar" id="dash-filters">
        <label class="field">
          <span>Филиал</span>
          <select id="filter-branch">${branchOpts}</select>
        </label>
        <label class="field">
          <span>Период</span>
          <select id="filter-period">${periodOpts}</select>
        </label>
        <button type="button" class="btn btn-accent" id="btn-apply">Применить</button>
        <button type="button" class="btn btn-ghost" id="btn-reset-demo">Сбросить демо</button>
        <p class="sidebar-note">${escapeHtml(slice.date_range)}</p>
      </aside>
      <div class="demo-main">
        <nav class="demo-nav" aria-label="Разделы">
          <button type="button" class="nav-btn ${state.primary === "overview" && state.more === "none" ? "active" : ""}" data-nav="overview">Обзор</button>
          <button type="button" class="nav-btn ${state.primary === "noshow" && state.more === "none" ? "active" : ""}" data-nav="noshow">Неявки</button>
          <div class="nav-more">
            <button type="button" class="nav-btn" id="nav-more-toggle" aria-expanded="false">⋯</button>
            <div class="nav-more-menu" id="nav-more-menu" hidden>
              <button type="button" data-more="transitions">Переходы</button>
              <button type="button" data-more="ads">Реклама</button>
              <button type="button" data-more="labels">Ярлыки в YClients</button>
            </div>
          </div>
        </nav>
        ${
          state.more === "none" && state.primary === "overview"
            ? `<div class="subtabs">
                <button type="button" class="subtab ${state.overviewTab === "summary" ? "active" : ""}" data-tab="summary">Сводка</button>
                <button type="button" class="subtab ${state.overviewTab === "calls" ? "active" : ""}" data-tab="calls">Обзвон</button>
              </div>`
            : ""
        }
        <div id="dash-content">${renderContent(payload, state, slice)}</div>
      </div>
    </div>
  </div>`;
}

function renderContent(payload: DemoPayload, state: DashboardState, slice: DashboardSlice): string {
  if (state.more === "labels") return renderLabels(payload);
  if (state.more === "ads") return renderAds(slice);
  if (state.more === "transitions") return renderTransitions(payload);
  if (state.primary === "noshow") return renderNoshow(slice);
  if (state.overviewTab === "calls") return renderCalls(slice);
  return renderSummary(slice);
}

function renderSummary(slice: DashboardSlice): string {
  const k = slice.kpis;
  const yadroPctClients =
    slice.segments.find((s) => s.segment === "Ядро")?.pct_clients ?? 0;
  return `
  <section id="summary-panel">
    <div class="kpi-row" id="kpi-row">
      ${kpiCard("Клиентов в базе", formatNumber(k.clients))}
      ${kpiCard("Выручка за период", formatMoney(k.revenue))}
      ${kpiCard("Доля «Ядра»", formatPct(k.yadro_pct_revenue), `${formatPct(yadroPctClients)} клиентов`)}
      ${kpiCard("Средний чек", formatMoney(k.avg_check))}
      ${kpiCard("Неявки", formatPct(k.noshow_pct_12m))}
    </div>
    <p class="segment-hint">Нажмите на группу, чтобы открыть список клиентов</p>
    <div class="charts-row">
      <div class="chart-card">
        <h3>Состав базы · клиенты</h3>
        <div class="chart" id="chart-clients"></div>
      </div>
      <div class="chart-card">
        <h3>Состав базы · выручка</h3>
        <div class="chart" id="chart-revenue"></div>
      </div>
    </div>
    <div class="week-box">
      <h3>Что делать на этой неделе</h3>
      ${
        slice.week_actions.length
          ? `<ul>${slice.week_actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
          : `<p class="muted">По выбранному срезу срочных действий нет.</p>`
      }
    </div>
    <div id="segment-table">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Группа</th><th>Действие</th><th>Клиенты</th><th>Доля</th><th>Выручка</th><th>% выручки</th>
        </tr></thead>
        <tbody>
          ${slice.segments
            .map(
              (s) => `<tr class="segment-row" data-segment="${escapeHtml(s.segment)}" tabindex="0" role="button">
              <td><strong>${escapeHtml(s.segment)}</strong></td>
              <td><span class="action-pill">${escapeHtml(s.action)}</span></td>
              <td>${formatNumber(s.clients)}</td>
              <td>${formatPct(s.pct_clients)}</td>
              <td>${formatMoney(s.revenue)}</td>
              <td>${formatPct(s.pct_revenue)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="card-list segment-cards" id="segment-cards">
      ${slice.segments
        .map(
          (s) => `<button type="button" class="mini-card segment-card" data-segment="${escapeHtml(s.segment)}">
          <strong>${escapeHtml(s.segment)}</strong>
          <span class="action-pill">${escapeHtml(s.action)}</span>
          <span>${formatNumber(s.clients)} · ${formatMoney(s.revenue)}</span>
        </button>`,
        )
        .join("")}
    </div>
    <p class="segment-note" id="segment-note" role="status" aria-live="polite"></p>
    </div>
  </section>`;
}

function renderCalls(slice: DashboardSlice): string {
  const ukhodyat = slice.call_lists.ukhodyat;
  const yadro = slice.call_lists.yadro_no_booking;
  const novichki = slice.call_lists.novichki;
  return `
  <section id="calls-panel">
    <article class="list-block" id="list-ukhodyat">
      <div class="list-head">
        <h3>Уходят — топ-20</h3>
        <button type="button" class="btn btn-small excel-btn" data-excel="ukhodyat" ${ukhodyat.length ? "" : "disabled title=\"Список пуст на этом периоде — выберите «Вся база с 2023»\""}>Скачать Excel</button>
      </div>
      ${callTable(ukhodyat, "В группе «Уходят» нет клиентов по фильтру. На коротком периоде так бывает — попробуйте «Вся база с 2023».")}
    </article>
    <article class="list-block" id="list-yadro">
      <div class="list-head">
        <h3>Ядро без будущей записи — топ-20</h3>
        <button type="button" class="btn btn-small excel-btn" data-excel="yadro" ${yadro.length ? "" : "disabled title=\"Список пуст\""}>Скачать Excel</button>
      </div>
      ${callTable(yadro, "У всех из «Ядра» уже есть запись вперёд.")}
    </article>
    <article class="list-block" id="list-novichki">
      <div class="list-head">
        <h3>Новички — дожим — топ-20</h3>
        <button type="button" class="btn btn-small excel-btn" data-excel="novichki" ${novichki.length ? "" : "disabled title=\"Список пуст\""}>Скачать Excel</button>
      </div>
      ${callTable(novichki, "Новичков без будущей записи нет.")}
    </article>
  </section>`;
}

function renderNoshow(slice: DashboardSlice): string {
  const s = slice.noshow.summary;
  return `
  <section id="noshow-panel">
    <div class="kpi-row">
      ${kpiCard("Неявки за 12 мес.", formatPct(Number(s.noshow_pct_12m || 0)))}
      ${kpiCard("Потерянная выручка", formatMoney(Number(s.lost_revenue_12m || 0)))}
      ${kpiCard("Предоплата рекомендована", formatNumber(Number(s.prepay_recommended || 0)))}
    </div>
    <article class="list-block">
      <div class="list-head">
        <h3>Предоплата рекомендована — топ-50</h3>
        <button type="button" class="btn btn-small excel-btn" data-excel="prepay">Скачать Excel</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Клиент</th><th>Телефон</th><th>Серия</th><th>Доля неявок</th><th>Потери</th></tr></thead>
          <tbody>
            ${slice.noshow.prepay_list
              .map(
                (r) => `<tr>
                <td>${escapeHtml(r.client_name)}</td>
                <td>${escapeHtml(r.phone_fmt ?? "")}</td>
                <td>${r.noshow_streak ?? "—"}</td>
                <td>${formatPct((r.noshow_rate_12m ?? 0) * 100)}</td>
                <td>${formatMoney(r.lost_revenue_12m)}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </article>
  </section>`;
}

function renderTransitions(payload: DemoPayload): string {
  const t = payload.transitions;
  const kpis = Object.entries(t.kpis || {})
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(v ?? "—"))}</li>`)
    .join("");
  return `
  <section id="transitions-panel">
    <h3>Переходы · ${escapeHtml(t.pair_label || "два периода")}</h3>
    <ul class="plain-list">${kpis || "<li class='muted'>Нет сводных показателей</li>"}</ul>
    <h4>Ухудшились за период</h4>
    ${callTable(t.worsened as DashboardSlice["call_lists"]["ukhodyat"], "Нет клиентов с ухудшением сегмента.")}
    <h4>Потоки</h4>
    <ul class="plain-list">
      ${(t.flows || [])
        .map((f) => `<li>${escapeHtml(f.flow)}: ${formatNumber(f.clients)}</li>`)
        .join("") || "<li class='muted'>Нет данных по потокам</li>"}
    </ul>
  </section>`;
}

function renderAds(slice: DashboardSlice): string {
  return `
  <section id="ads-panel">
    <h3>Реклама · каналы привлечения</h3>
    <p class="muted">Демонстрационный разрез по каналам для примера салона (не боевые метки CRM).</p>
    <div class="chart chart-tall" id="chart-ads"></div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Канал</th><th>Клиенты</th><th>Доля</th></tr></thead>
        <tbody>
          ${slice.ads.channels
            .map(
              (c) => `<tr>
              <td>${escapeHtml(c.channel)}</td>
              <td>${formatNumber(c.clients)}</td>
              <td>${formatPct(c.share_pct)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderLabels(payload: DemoPayload): string {
  const L = payload.labels_preview;
  return `
  <section id="labels-block">
    <h3>${escapeHtml(L.title)}</h3>
    <p>${escapeHtml(L.summary)}</p>
    <div class="labels-stats">
      <div>Обновить: <strong>${formatNumber(L.would_update)}</strong></div>
      <div>Без изменений: <strong>${formatNumber(L.would_skip)}</strong></div>
    </div>
    <button type="button" class="btn btn-accent" id="btn-labels-sim">Обновить ярлыки</button>
    <div id="labels-progress" class="labels-progress" hidden></div>
    <div class="table-wrap" style="margin-top:1rem">
      <table class="data-table">
        <thead><tr><th>Клиент</th><th>Было</th><th>Станет</th></tr></thead>
        <tbody>
          ${L.sample
            .map(
              (s) => `<tr>
              <td>${escapeHtml(s.name)}</td>
              <td>${escapeHtml(s.from)}</td>
              <td>${escapeHtml(s.to)}</td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

export function mountDashboard(
  root: HTMLElement,
  payload: DemoPayload,
  state: DashboardState,
  hooks: DashboardHooks,
): void {
  disposeCharts();
  root.innerHTML = renderDashboardShell(payload, state);
  const slice = getSlice(payload, state.branch, state.period);

  const branch = root.querySelector<HTMLSelectElement>("#filter-branch");
  const period = root.querySelector<HTMLSelectElement>("#filter-period");
  branch?.addEventListener("change", () => {
    state.draftBranch = branch.value;
  });
  period?.addEventListener("change", () => {
    state.draftPeriod = period.value;
  });

  root.querySelector("#btn-apply")?.addEventListener("click", () => {
    state.branch = state.draftBranch;
    state.period = state.draftPeriod;
    hooks.onApply();
    trackGoal("filters_apply", { branch: state.branch, period: state.period });
    mountDashboard(root, payload, state, hooks);
  });

  root.querySelector("#btn-reset-demo")?.addEventListener("click", () => {
    Object.assign(state, initialState(payload));
    mountDashboard(root, payload, state, hooks);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.primary = btn.dataset.nav as PrimaryNav;
      state.more = "none";
      trackGoal("section_open", { section: state.primary });
      mountDashboard(root, payload, state, hooks);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.overviewTab = btn.dataset.tab as OverviewTab;
      trackGoal("section_open", { section: `overview_${state.overviewTab}` });
      mountDashboard(root, payload, state, hooks);
    });
  });

  const moreToggle = root.querySelector<HTMLButtonElement>("#nav-more-toggle");
  const moreMenu = root.querySelector<HTMLElement>("#nav-more-menu");
  const closeMoreMenu = (): void => {
    const menu = root.querySelector<HTMLElement>("#nav-more-menu");
    const toggle = root.querySelector<HTMLButtonElement>("#nav-more-toggle");
    if (!menu || !toggle) return;
    menu.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", "false");
  };
  moreToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!moreMenu) return;
    const open = moreMenu.hasAttribute("hidden");
    if (open) {
      moreMenu.removeAttribute("hidden");
      moreToggle.setAttribute("aria-expanded", "true");
    } else {
      closeMoreMenu();
    }
  });
  if (root.dataset.moreMenuBound !== "1") {
    root.dataset.moreMenuBound = "1";
    root.addEventListener("click", (e) => {
      const menu = root.querySelector<HTMLElement>("#nav-more-menu");
      if (!menu || menu.hasAttribute("hidden")) return;
      if ((e.target as HTMLElement | null)?.closest(".nav-more")) return;
      closeMoreMenu();
    });
  }
  root.querySelectorAll<HTMLButtonElement>("[data-more]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.more = btn.dataset.more as MoreNav;
      trackGoal("section_open", { section: state.more });
      mountDashboard(root, payload, state, hooks);
    });
  });

  const onSegment = (name: string) => {
    hooks.onSegmentClick(name);
    trackGoal("segment_open", { segment: name });
    const listId = SEGMENT_CALL_LISTS[name];
    if (!listId) {
      const note = root.querySelector<HTMLElement>("#segment-note");
      if (note) note.textContent = SEGMENT_NO_LIST_NOTES[name] ?? "";
      return;
    }
    state.primary = "overview";
    state.overviewTab = "calls";
    state.more = "none";
    mountDashboard(root, payload, state, hooks);
    focusCallList(root, listId);
  };
  root.querySelectorAll<HTMLElement>("[data-segment]").forEach((el) => {
    el.addEventListener("click", () => onSegment(el.dataset.segment || ""));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSegment(el.dataset.segment || "");
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>(".excel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      hooks.onExcel();
      const kind = btn.dataset.excel;
      if (kind === "ukhodyat") {
        downloadCallListExcel(slice.call_lists.ukhodyat, "m-salon-ukhodyat.xlsx", "Уходят");
      } else if (kind === "yadro") {
        downloadCallListExcel(
          slice.call_lists.yadro_no_booking,
          "m-salon-yadro.xlsx",
          "Ядро",
        );
      } else if (kind === "novichki") {
        downloadCallListExcel(slice.call_lists.novichki, "m-salon-novichki.xlsx", "Новички");
      } else if (kind === "prepay") {
        downloadPrepayExcel(slice.noshow.prepay_list, "m-salon-prepay.xlsx");
      }
    });
  });

  const labelsBtn = root.querySelector<HTMLButtonElement>("#btn-labels-sim");
  const progress = root.querySelector<HTMLElement>("#labels-progress");
  labelsBtn?.addEventListener("click", () => {
    if (!progress) return;
    progress.hidden = false;
    progress.textContent = "Обновление ярлыков… 0%";
    trackGoal("labels_simulate_start");
    let p = 0;
    const timer = window.setInterval(() => {
      p += 20;
      progress.textContent =
        p >= 100
          ? `Готово: обновлено ${payload.labels_preview.would_update}, без изменений ${payload.labels_preview.would_skip}. (имитация)`
          : `Обновление ярлыков… ${p}%`;
      if (p >= 100) {
        window.clearInterval(timer);
        trackGoal("labels_simulate_done");
      }
    }, 280);
  });

  requestAnimationFrame(() => {
    const clients = root.querySelector<HTMLElement>("#chart-clients");
    const revenue = root.querySelector<HTMLElement>("#chart-revenue");
    if (clients && revenue) renderSegmentPies(clients, revenue, slice.segments, onSegment);
    const ads = root.querySelector<HTMLElement>("#chart-ads");
    if (ads) renderAdsBars(ads, slice.ads.channels);
    resizeCharts();
  });
}

export function setDashboardView(
  state: DashboardState,
  view: { primary?: PrimaryNav; overviewTab?: OverviewTab; more?: MoreNav },
): void {
  if (view.primary) state.primary = view.primary;
  if (view.overviewTab) state.overviewTab = view.overviewTab;
  if (view.more !== undefined) state.more = view.more;
}
