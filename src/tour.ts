import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { trackGoal } from "./metrika";

const STORAGE_KEY = "ai-manager-tour-done";
const INVITE_KEY = "ai-manager-tour-invite-seen";

export type TourActions = {
  goOverviewSummary: () => void;
  goOverviewCalls: () => void;
  goLabels: () => void;
  /** Keep «Последние 90 дней» so «Уходят» has demo rows for later steps. */
  ensureTourPeriod: () => void;
  onApplyClicked: (cb: () => void) => void;
  onSegmentClicked: (cb: (name: string) => void) => void;
  onExcelClicked: (cb: () => void) => void;
};

function isMobile(): boolean {
  return window.matchMedia("(max-width: 760px)").matches;
}

export function hasCompletedTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasSeenTourInvite(): boolean {
  try {
    return localStorage.getItem(INVITE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markTourInviteSeen(): void {
  try {
    localStorage.setItem(INVITE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Invite first-time visitors to take the guided tour before browsing alone. */
export function shouldOfferTour(): boolean {
  return !hasCompletedTour() && !hasSeenTourInvite();
}

function resolveStepElement(step: DriveStep | undefined): Element | null {
  if (!step?.element) return null;
  const raw = step.element;
  if (typeof raw === "function") {
    try {
      return raw();
    } catch {
      return null;
    }
  }
  if (typeof raw === "string") return document.querySelector(raw);
  return raw;
}

export function startTour(actions: TourActions): void {
  let applyUnlocked = false;
  let segmentUnlocked = false;
  let excelUnlocked = false;
  let drv: ReturnType<typeof driver> | null = null;
  let rebindTimer = 0;

  /**
   * Dashboard remounts replace the highlighted node. driver.refresh() only
   * repositions around the stale __activeElement, so the SVG overlay hole
   * drifts away and its path (inline pointer-events:auto) blocks clicks.
   * Rebind the live node into driver state, then refresh.
   */
  const rebindTourHighlight = (): void => {
    window.clearTimeout(rebindTimer);
    rebindTimer = window.setTimeout(() => {
      if (!drv?.isActive()) return;
      const step = drv.getActiveStep();
      const fresh = resolveStepElement(step);
      if (!fresh) {
        drv.refresh();
        return;
      }
      const prev = drv.getActiveElement();
      if (prev && prev !== fresh) {
        prev.classList.remove("driver-active-element", "driver-no-interaction");
        prev.removeAttribute("aria-haspopup");
        prev.removeAttribute("aria-expanded");
        prev.removeAttribute("aria-controls");
        const prevParent = prev.parentElement;
        if (prevParent && prevParent !== document.body) {
          prevParent.classList.remove(
            "driver-active-element-parent",
            "driver-active-element-parent-no-scroll",
          );
        }
      }
      fresh.classList.add("driver-active-element");
      const parent = fresh.parentElement;
      if (parent && parent !== document.body) {
        parent.classList.add("driver-active-element-parent");
      }
      const state = drv.getState() as {
        activeElement?: Element;
        __activeElement?: Element;
      };
      state.activeElement = fresh;
      state.__activeElement = fresh;
      drv.refresh();
    }, 60);
  };

  const unlockNext = (): void => {
    const btn = document.querySelector<HTMLButtonElement>(".driver-popover-next-btn");
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("driver-blocked");
    }
  };

  const lockNext = (): void => {
    const btn = document.querySelector<HTMLButtonElement>(".driver-popover-next-btn");
    if (btn) {
      btn.disabled = true;
      btn.classList.add("driver-blocked");
    }
  };

  actions.onApplyClicked(() => {
    applyUnlocked = true;
    unlockNext();
    rebindTourHighlight();
  });
  actions.onSegmentClicked((name) => {
    if (name === "Уходят") {
      segmentUnlocked = true;
      unlockNext();
      rebindTourHighlight();
    }
  });
  actions.onExcelClicked(() => {
    excelUnlocked = true;
    unlockNext();
    rebindTourHighlight();
  });

  const steps: DriveStep[] = [
    {
      element: "#demo-app",
      popover: {
        title: "Шаг 1 из 8",
        description:
          "Перед вами рабочий дашборд салона — всё на вымышленных данных студии «M-Salon» (Уфа). Две минуты, и вы увидите, кому ваш администратор будет звонить завтра. Можно кликать что угодно, сломать ничего нельзя.",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: "#chart-clients",
      popover: {
        title: "Шаг 2 из 8",
        description:
          "Главная идея простая: база — это не одно число, а разные люди. Кто-то ходит к вам годами, кто-то зашёл один раз, а кто-то уже тихо перестал приходить. Здесь база разложена на пять групп по тому, когда человек был, как часто ходит и сколько оставляет.",
        side: isMobile() ? "top" : "left",
      },
      onHighlightStarted: () => {
        actions.goOverviewSummary();
        rebindTourHighlight();
      },
    },
    {
      element: "#dash-filters",
      disableActiveInteraction: false,
      popover: {
        title: "Шаг 3 из 8",
        description:
          "Слева — филиал и период. Переключите период на «Последние 90 дней» и нажмите «Применить» — так вы увидите срез, на котором уже есть кого возвращать. На совсем коротких 30 днях «Уходят» часто пустая.",
        side: isMobile() ? "bottom" : "right",
      },
      onHighlightStarted: () => {
        actions.ensureTourPeriod();
        actions.goOverviewSummary();
        rebindTourHighlight();
      },
      onHighlighted: () => {
        if (!applyUnlocked) lockNext();
      },
    },
    {
      element: "#kpi-row",
      popover: {
        title: "Шаг 4 из 8",
        description:
          "Это экран собственника на пять минут после обновления данных: сколько клиентов, сколько денег, какая доля приходится на постоянных. Если доля «Ядра» падает — салон живёт за счёт новых людей, а это самый дорогой способ зарабатывать.",
      },
    },
    {
      element: "#segment-table",
      popover: {
        title: "Шаг 5 из 8",
        description:
          "У каждой группы своё действие: Ядро держать, Новичков дожимать до второго визита, Растущих выращивать, Уходящих возвращать, на Спящих не тратиться. Нажмите на «Уходят» — посмотрим, кто это у M-Salon на 90 днях.",
      },
      onHighlightStarted: () => {
        actions.ensureTourPeriod();
        actions.goOverviewSummary();
        rebindTourHighlight();
      },
      onHighlighted: () => {
        if (!segmentUnlocked) lockNext();
      },
    },
    {
      element: "#calls-panel",
      popover: {
        title: "Шаг 6 из 8",
        description:
          "Вот ради чего всё остальное. Не вся база, а короткий список на смену: кто уходит, кто из постоянных не записан на будущее, кого из новичков надо дожать. Нажмите «Скачать Excel» у списка «Уходят» — файл откроется у вас на компьютере, его можно отдать администратору как есть.",
      },
      onHighlightStarted: () => {
        actions.ensureTourPeriod();
        actions.goOverviewCalls();
        rebindTourHighlight();
      },
      onHighlighted: () => {
        if (!excelUnlocked) lockNext();
      },
    },
    {
      element: "#labels-block",
      popover: {
        title: "Шаг 7 из 8",
        description:
          "И главное отличие от обычных отчётов: группы проставляются обратно в карточки клиентов в вашем YClients. Администратор видит «Уходит» прямо в карточке, не заглядывая в аналитику. А рассылку по группе можно сделать средствами самого YClients.",
      },
      onHighlightStarted: () => {
        actions.goLabels();
        rebindTourHighlight();
      },
    },
    {
      element: "#data-safety",
      popover: {
        title: "Шаг 8 из 8",
        description:
          "Программа работает на компьютере салона и только читает YClients — записывает она лишь эти ярлыки. База клиентов никуда не уезжает, токены менеджерам не раздаются. Хотите такой же дашборд на своих данных — оставьте контакт, покажем на вашей базе.",
        side: "top",
      },
    },
  ];

  trackGoal("tour_start");
  let stepIndex = 0;

  drv = driver({
    showProgress: true,
    allowClose: true,
    disableActiveInteraction: false,
    // Keep tour open while user clicks filters / native <select> (options sit outside stage).
    overlayClickBehavior: () => undefined,
    overlayColor: "rgba(16, 34, 28, 0.55)",
    stagePadding: 8,
    popoverClass: isMobile() ? "tour-popover tour-mobile" : "tour-popover",
    nextBtnText: "Дальше",
    prevBtnText: "Назад",
    doneBtnText: "Готово",
    progressText: "{{current}} из {{total}}",
    steps,
    onNextClick: (_el, _step, { driver: active }) => {
      const needGate =
        (stepIndex === 2 && !applyUnlocked) ||
        (stepIndex === 4 && !segmentUnlocked) ||
        (stepIndex === 5 && !excelUnlocked);
      if (needGate) return;
      trackGoal(`tour_step_${stepIndex + 1}`);
      if (active.isLastStep()) {
        trackGoal("tour_complete");
        markTourDone();
        active.destroy();
        return;
      }
      stepIndex += 1;
      active.moveNext();
    },
    onDestroyStarted: () => {
      if (!drv) return;
      if (!drv.isLastStep()) trackGoal("tour_skip", { at: stepIndex + 1 });
      drv.destroy();
    },
  });

  drv.drive();
}
