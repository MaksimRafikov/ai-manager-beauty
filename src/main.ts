import "./style.css";
import { resizeCharts } from "./charts";
import { loadDemoData } from "./data";
import {
  initialState,
  mountDashboard,
  setDashboardView,
  type DashboardHooks,
  type DashboardState,
} from "./dashboard";
import { escapeHtml } from "./format";
import { initMetrika, trackGoal } from "./metrika";
import {
  hasCompletedTour,
  markTourInviteSeen,
  shouldOfferTour,
  startTour,
  type TourActions,
} from "./tour";
import type { DemoPayload } from "./types";

/** Formspree delivers email automatically; Telegram is fallback if POST fails. */
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xppwgapv";
const TG_USER = "mxm_r";

type LeadPayload = {
  name: string;
  contact: string;
  salon: string;
  branches: string;
  base_size: string;
  comment: string;
};

const LEAD_SUBJECT = "Заявка — AI-маркетолог салона красоты";

function buildLeadMessage(data: LeadPayload): string {
  const lines = [
    LEAD_SUBJECT,
    "",
    data.name ? `Имя: ${data.name}` : null,
    `Контакт: ${data.contact}`,
    data.salon ? `Салон: ${data.salon}` : null,
    data.branches ? `Филиалов: ${data.branches}` : null,
    data.base_size ? `Клиентов в базе (примерно): ${data.base_size}` : null,
    data.comment ? `Комментарий: ${data.comment}` : null,
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}

function openTelegramDraft(data: LeadPayload): void {
  const url = `https://t.me/${TG_USER}?text=${encodeURIComponent(buildLeadMessage(data))}`;
  window.open(url, "_blank", "noopener");
}

function setFormStatus(el: HTMLElement | null, message: string, state?: "ok" | "error"): void {
  if (!el) return;
  el.replaceChildren();
  el.textContent = message;
  if (state) el.dataset.state = state;
  else delete el.dataset.state;
}

async function submitLeadToFormspree(data: LeadPayload): Promise<void> {
  const body = new FormData();
  body.set("_subject", LEAD_SUBJECT);
  body.set("name", data.name);
  body.set("contact", data.contact);
  body.set("salon", data.salon);
  body.set("branches", data.branches);
  if (data.base_size) body.set("base_size", data.base_size);
  if (data.comment) body.set("comment", data.comment);
  body.set("source", "ai-manager-beauty");

  const res = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    headers: { Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(String(res.status));
}

const METHOD_SEGMENTS: { name: string; action: string; text: string }[] = [
  {
    name: "Ядро",
    action: "держать",
    text: "Постоянные клиенты — те, на ком салон держится. Сюда попадают не только частые гости: клиентка с редким, но крупным окрашиванием тоже в Ядре. Учитываем и частоту, и сумму.",
  },
  {
    name: "Новички",
    action: "дожать",
    text: "Пришли недавно, были раз или два. Судьба этих денег решается на втором визите: не вернулся — бюджет на привлечение сгорел.",
  },
  {
    name: "Растут",
    action: "вырастить",
    text: "Ходят, но пока нерегулярно. Ближайший резерв: вырастить постоянного дешевле, чем купить нового.",
  },
  {
    name: "Уходят",
    action: "вернуть",
    text: "Раньше ходили как свои, а теперь пропали. Их не надо привлекать заново — достаточно вовремя напомнить. Именно про них узнают последними.",
  },
  {
    name: "Спящие",
    action: "не тратить",
    text: "Давно не приходят, шансов мало. Польза обратная: не тратить на них рассылки, скидки и время администратора.",
  },
];

function renderPage(payload: DemoPayload): string {
  const product = payload.meta.product_name;
  return `
  <header class="site-header">
    <a class="brand" href="#top">${escapeHtml(product)}</a>
    <nav class="site-nav">
      <button type="button" class="btn-tour" id="btn-restart-tour" aria-label="Пройти тур по дашборду, около 2 минут">
        <span class="btn-tour-label">Пройти тур</span>
        <span class="btn-tour-hint">2 мин</span>
      </button>
      <a href="#dashboard">Дашборд</a>
      <a class="btn btn-small" href="#lead">Оставить заявку</a>
    </nav>
  </header>

  <div class="tour-invite" id="tour-invite" hidden role="dialog" aria-modal="true" aria-labelledby="tour-invite-title">
    <div class="tour-invite-backdrop" data-tour-invite-dismiss></div>
    <div class="tour-invite-panel">
      <p class="tour-invite-eyebrow">Демо · 8 шагов</p>
      <h2 id="tour-invite-title">Сначала короткий тур?</h2>
      <p class="tour-invite-lead">За две минуты покажем, как читать дашборд и кому администратор должен позвонить завтра. Можно кликать что угодно — сломать ничего нельзя.</p>
      <div class="tour-invite-actions">
        <button type="button" class="btn btn-accent" id="tour-invite-start">Пройти тур</button>
        <button type="button" class="btn btn-ghost" id="tour-invite-skip" data-tour-invite-dismiss>Смотреть самому</button>
      </div>
    </div>
  </div>

  <main id="top">
    <section class="hero">
      <p class="hero-product">${escapeHtml(product)}</p>
      <h1>Кто реально приносит прибыль вашему салону?</h1>
      <p class="hero-lead">Диагностика клиентской базы из YClients: кто приносит выручку, кто уходит и кому администратор позвонит завтра.</p>
      <div class="hero-cta">
        <button type="button" class="btn btn-accent" id="cta-try">Пройти тур по дашборду</button>
        <a class="btn btn-ghost" href="#lead">Оставить заявку</a>
      </div>
    </section>

    <section class="method" id="method">
      <div class="method-inner">
        <h2>Выручка у вас одна, а клиенты — разные</h2>
        <div class="method-copy">
          <p>О каждом вашем клиенте YClients уже знает три простые вещи: когда человек был у вас в последний раз, как часто он приходит и сколько у вас оставляет. Вместе эти три факта говорят о клиенте больше, чем любая общая цифра по салону.</p>
          <p>Общая цифра по салону не говорит, кто приносит деньги. Выручка стоит или падает, бюджет на рекламу растёт, а непонятно, кого вы теряете: постоянных, новичков или тех, кто пришёл по рекламе и не вернулся.</p>
          <p>Если посмотреть на базу по этим трём признакам, гости сами собираются в понятные группы. Главная — Ядро — постоянные клиенты: на них держится выручка. И для каждой группы есть одно понятное действие.</p>
        </div>
        <div class="flow-scheme" id="flow-scheme" aria-hidden="true">
          <div class="flow-source">Клиентская база</div>
          <div class="flow-arms">
            ${METHOD_SEGMENTS.map((s) => `<div class="flow-arm"><span>${s.name}</span><em>${s.action}</em></div>`).join("")}
          </div>
        </div>
        <div class="segment-grid">
          ${METHOD_SEGMENTS.map(
            (s) => `<article class="segment-explain">
              <h3>${s.name} — <em>${s.action}</em></h3>
              <p>${s.text}</p>
            </article>`,
          ).join("")}
        </div>
        <p class="method-close">Это не новая теория — так с клиентской базой работают в рознице уже десятки лет. Новое здесь только одно: вам не нужно ничего считать, выгружать и сводить руками. Всё это уже лежит в вашем YClients, просто никто на него так не смотрит.</p>
        <a class="btn btn-ghost" href="#dashboard">Сразу к дашборду</a>
      </div>
    </section>

    <section class="dashboard-section" id="dashboard">
      <div class="section-head">
        <h2>Дашборд на данных ${escapeHtml(payload.meta.salon_name)}</h2>
        <p>Интерактивный пример. Цифры синтетические, логика сегментов — как в продукте.</p>
      </div>
      <div id="dashboard-root"></div>
      <aside class="rhythm" id="rhythm">
        <details open>
          <summary>Ритм работы</summary>
          <ol>
            <li>Обновить данные из YClients</li>
            <li>Собственник смотрит сводку</li>
            <li>Управляющий забирает списки на обзвон</li>
            <li>Администратор звонит</li>
            <li>Группы автоматически проставляются в карточках YClients</li>
          </ol>
        </details>
      </aside>
    </section>

    <section class="labels-promo" id="labels-promo">
      <div class="labels-promo-copy">
        <h2>Группы сами появляются в карточках YClients</h2>
        <p>Программа сама проставляет группу каждому клиенту в его карточке YClients. Не нужно вручную ставить ярлыки тысячам гостей.</p>
        <p>Администратор открывает карточку и сразу видит: перед ним постоянный клиент или тот, кто уходит.</p>
        <button type="button" class="btn btn-ghost" id="labels-promo-demo">Посмотреть в демо</button>
      </div>
      <div class="client-card-mock" aria-hidden="true">
        <div class="client-card-head">
          <span class="client-card-avatar">АК</span>
          <div>
            <strong>Анна К.</strong>
            <span class="client-card-meta">Последний визит 74 дня назад</span>
          </div>
        </div>
        <div class="client-card-labels">
          <span class="client-chip">Уходят</span>
        </div>
        <dl class="client-card-facts">
          <div><dt>Визитов</dt><dd>14</dd></div>
          <div><dt>Услуга</dt><dd>Окрашивание</dd></div>
        </dl>
      </div>
    </section>

    <section class="roles" id="roles">
      <h2>Как это выглядит в работе</h2>
      <div class="roles-grid">
        <article>
          <h3>Собственник</h3>
          <p>Пять минут после обновления: какая доля выручки приходится на постоянных клиентов и кого возвращать на этой неделе.</p>
        </article>
        <article>
          <h3>Управляющий</h3>
          <p>Три готовых списка на смену и выгрузка в Excel одной кнопкой — без ручной сборки из отчётов.</p>
        </article>
        <article>
          <h3>Администратор</h3>
          <p>Видит группу в карточке YClients и звонит по короткому списку, а не по всей базе.</p>
        </article>
      </div>
    </section>

    <section class="howto" id="howto">
      <h2>Как устроено и что с данными</h2>
      <div class="howto-grid">
        <article id="data-safety">
          <h3>Данные остаются у вас</h3>
          <p>Программа работает на компьютере салона. База клиентов не уходит в интернет — это защита от утечки.</p>
        </article>
        <article>
          <h3>Интеграция с YClients</h3>
          <p>Интегрируем панель с вашим YClients: она берёт записи и клиентов и проставляет группы в карточки.</p>
        </article>
        <article>
          <h3>Границы</h3>
          <p>Не заменяет CRM и не рассылает сообщения. Показывает, кому и зачем позвонить.</p>
        </article>
      </div>
      <p class="howto-note">Убираем дубли: один гость с разных филиалов или 8… и +7… — один клиент.</p>
      <details class="accordion">
        <summary>Как считаются группы</summary>
        <p>Группы строятся по трём признакам: давность последнего визита, частота визитов и сумма. Пороги настраиваем под ваш салон: у окрашивания, стрижки и маникюра разный ритм.</p>
      </details>
    </section>

    <section class="lead" id="lead">
      <h2>Оставить заявку</h2>
      <p>Внедрение от 50&nbsp;000&nbsp;₽, точная цена после оценки базы. Срок 1–2 недели. Ответим в ближайшее время.</p>
      <form class="lead-form" id="lead-form" novalidate>
        <input type="text" name="company_website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <label>Имя
          <input name="name" required maxlength="80" autocomplete="name" />
        </label>
        <label>Телефон или Telegram
          <input name="contact" required maxlength="80" autocomplete="tel" />
        </label>
        <label>Название салона
          <input name="salon" required maxlength="120" />
        </label>
        <label>Число филиалов
          <input name="branches" type="number" min="1" max="50" required value="1" />
        </label>
        <label>Примерно клиентов в базе <span class="optional">необязательно</span>
          <input name="base_size" inputmode="numeric" maxlength="20" placeholder="например, 5 000" />
        </label>
        <label>Комментарий
          <textarea name="comment" rows="3" maxlength="500"></textarea>
        </label>
        <label class="check">
          <input type="checkbox" name="consent" required />
          <span>Согласен(на) на обработку персональных данных. <a href="/privacy.html" target="_blank" rel="noopener">Политика</a></span>
        </label>
        <button type="submit" class="btn btn-accent">Отправить заявку</button>
        <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
        <p class="muted contacts">
          Или напрямую:
          <a href="tel:+79173899983">+7&nbsp;917&nbsp;389-99-83</a>
          ·
          <a href="https://t.me/mxm_r" rel="noopener" target="_blank">Telegram @mxm_r</a>
          ·
          <a href="https://maximrafikov.ru" rel="noopener" target="_blank">maximrafikov.ru</a>
        </p>
      </form>
    </section>
  </main>

  <footer class="site-footer">
    <span>${escapeHtml(product)}</span>
    <span class="footer-contacts">
      <a href="tel:+79173899983">+7&nbsp;917&nbsp;389-99-83</a>
      ·
      <a href="https://t.me/mxm_r" rel="noopener" target="_blank">@mxm_r</a>
      ·
      <a href="https://maximrafikov.ru" rel="noopener" target="_blank">maximrafikov.ru</a>
    </span>
    <span>Демо-салон ${escapeHtml(payload.meta.salon_name)}, ${escapeHtml(payload.meta.city)}</span>
  </footer>`;
}

async function main(): Promise<void> {
  initMetrika();
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  let payload: DemoPayload;
  try {
    payload = await loadDemoData();
  } catch (err) {
    app.innerHTML = `<p class="boot-error">Не удалось загрузить демо-данные. ${escapeHtml(String(err))}</p>`;
    return;
  }

  document.title = `${payload.meta.product_name} — демо`;
  app.innerHTML = renderPage(payload);

  const dashRoot = document.querySelector<HTMLElement>("#dashboard-root");
  if (!dashRoot) return;
  const state: DashboardState = initialState(payload);

  let applyCb: (() => void) | null = null;
  let segmentCb: ((name: string) => void) | null = null;
  let excelCb: (() => void) | null = null;

  const remount = (): void => {
    mountDashboard(dashRoot, payload, state, hooks);
  };

  /** Remount only when the visible view actually changes (keeps tour highlight node alive). */
  const remountIfNeeded = (changed: boolean): void => {
    if (changed) remount();
  };

  const hooks: DashboardHooks = {
    onApply: () => applyCb?.(),
    onSegmentClick: (name) => segmentCb?.(name),
    onExcel: () => excelCb?.(),
  };

  remount();

  const tourActions: TourActions = {
    goOverviewSummary: () => {
      const same =
        state.primary === "overview" && state.overviewTab === "summary" && state.more === "none";
      setDashboardView(state, { primary: "overview", overviewTab: "summary", more: "none" });
      remountIfNeeded(!same);
    },
    goOverviewCalls: () => {
      const same =
        state.primary === "overview" && state.overviewTab === "calls" && state.more === "none";
      setDashboardView(state, { primary: "overview", overviewTab: "calls", more: "none" });
      remountIfNeeded(!same);
    },
    goLabels: () => {
      const same = state.more === "labels";
      setDashboardView(state, { more: "labels" });
      remountIfNeeded(!same);
    },
    ensureTourPeriod: () => {
      state.period = "last_90d";
      state.draftPeriod = "last_90d";
      const period = document.querySelector<HTMLSelectElement>("#filter-period");
      if (period) period.value = "last_90d";
    },
    onApplyClicked: (cb) => {
      applyCb = cb;
    },
    onSegmentClicked: (cb) => {
      segmentCb = cb;
    },
    onExcelClicked: (cb) => {
      excelCb = cb;
    },
  };

  const tourBtn = document.getElementById("btn-restart-tour");
  const invite = document.getElementById("tour-invite");

  const setTourBtnAttention = (on: boolean): void => {
    tourBtn?.classList.toggle("is-attention", on);
  };

  setTourBtnAttention(!hasCompletedTour());

  const hideInvite = (): void => {
    if (!invite || invite.hidden) return;
    invite.hidden = true;
    document.body.classList.remove("tour-invite-open");
  };

  const dismissInvite = (): void => {
    if (!invite || invite.hidden) return;
    hideInvite();
    markTourInviteSeen();
    trackGoal("tour_invite_dismiss");
  };

  const openInvite = (): void => {
    if (!invite) return;
    invite.hidden = false;
    document.body.classList.add("tour-invite-open");
    document.getElementById("tour-invite-start")?.focus();
    trackGoal("tour_invite_shown");
  };

  const launchTour = (): void => {
    const fromInvite = Boolean(invite && !invite.hidden);
    hideInvite();
    markTourInviteSeen();
    if (fromInvite) trackGoal("tour_invite_accept");
    setTourBtnAttention(false);
    document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => startTour(tourActions), 400);
  };

  tourBtn?.addEventListener("click", launchTour);
  document.getElementById("cta-try")?.addEventListener("click", launchTour);
  document.getElementById("tour-invite-start")?.addEventListener("click", launchTour);
  document.getElementById("labels-promo-demo")?.addEventListener("click", () => {
    tourActions.goLabels();
    trackGoal("labels_promo_demo");
    document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  invite?.querySelectorAll("[data-tour-invite-dismiss]").forEach((el) => {
    el.addEventListener("click", dismissInvite);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && invite && !invite.hidden) dismissInvite();
  });

  if (shouldOfferTour()) {
    window.setTimeout(openInvite, 600);
  }

  const scheme = document.getElementById("flow-scheme");
  if (scheme && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            scheme.classList.add("is-visible");
            trackGoal("method_viewed");
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(scheme);
  }

  const form = document.getElementById("lead-form") as HTMLFormElement | null;
  const status = document.getElementById("form-status");
  const submitBtn = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    // Honeypot — bots fill it; humans never see it.
    if (String(fd.get("company_website") || "").trim()) {
      setFormStatus(status, "Заявка отправлена. Ответим в ближайшее время.", "ok");
      form.reset();
      return;
    }

    if (!form.reportValidity()) {
      setFormStatus(status, "Заполните обязательные поля и согласие на обработку данных.", "error");
      return;
    }

    const payload: LeadPayload = {
      name: String(fd.get("name") || "").trim(),
      contact: String(fd.get("contact") || "").trim(),
      salon: String(fd.get("salon") || "").trim(),
      branches: String(fd.get("branches") || "").trim(),
      base_size: String(fd.get("base_size") || "").trim(),
      comment: String(fd.get("comment") || "").trim(),
    };

    if (!payload.contact || !payload.salon) {
      setFormStatus(status, "Укажите контакт и название салона.", "error");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setFormStatus(status, "Отправляем…");
    try {
      await submitLeadToFormspree(payload);
      trackGoal("lead_submit");
      form.reset();
      setFormStatus(status, "Заявка отправлена. Ответим в ближайшее время.", "ok");
    } catch {
      openTelegramDraft(payload);
      trackGoal("lead_submit_fallback");
      setFormStatus(
        status,
        "Не удалось отправить на почту автоматически. Открыл черновик в Telegram @mxm_r — нажмите «отправить» там.",
        "error",
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  window.addEventListener("resize", () => {
    resizeCharts();
  });
}

void main();
