import * as echarts from "echarts/core";
import { PieChart, BarChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { SegmentRow } from "./types";

echarts.use([PieChart, BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const SEGMENT_COLORS: Record<string, string> = {
  Ядро: "#1f6f5b",
  Новички: "#4f7fae",
  Растут: "#c4a35a",
  Уходят: "#b86b5a",
  Спящие: "#8a9390",
};

const charts = new Map<string, echarts.ECharts>();

function ensureChart(el: HTMLElement, key: string): echarts.ECharts {
  let chart = charts.get(key);
  if (chart && chart.getDom() !== el) {
    chart.dispose();
    charts.delete(key);
    chart = undefined;
  }
  if (!chart) {
    chart = echarts.init(el, undefined, { renderer: "canvas" });
    charts.set(key, chart);
  }
  return chart;
}

/** Dispose all chart instances (call before replacing dashboard DOM). */
export function disposeCharts(): void {
  charts.forEach((chart) => chart.dispose());
  charts.clear();
}

export function renderSegmentPies(
  clientsEl: HTMLElement,
  revenueEl: HTMLElement,
  segments: SegmentRow[],
  onSegmentClick?: (name: string) => void,
): void {
  const clients = ensureChart(clientsEl, "pie-clients");
  const revenue = ensureChart(revenueEl, "pie-revenue");
  const clientData = segments.map((s) => ({
    name: s.segment,
    value: s.clients,
    itemStyle: { color: SEGMENT_COLORS[s.segment] ?? "#888" },
  }));
  const revenueData = segments.map((s) => ({
    name: s.segment,
    value: s.revenue,
    itemStyle: { color: SEGMENT_COLORS[s.segment] ?? "#888" },
  }));
  const base = {
    tooltip: { trigger: "item" as const },
    legend: { bottom: 0, textStyle: { color: "#3a4541", fontSize: 11 } },
    series: [
      {
        type: "pie" as const,
        radius: ["42%", "68%"],
        center: ["50%", "44%"],
        label: { show: false },
        data: clientData,
      },
    ],
  };
  clients.setOption({ ...base, series: [{ ...base.series[0], data: clientData }] }, true);
  revenue.setOption({ ...base, series: [{ ...base.series[0], data: revenueData }] }, true);
  if (onSegmentClick) {
    for (const chart of [clients, revenue]) {
      chart.off("click");
      chart.on("click", (params) => {
        if (params.componentType === "series" && typeof params.name === "string") {
          onSegmentClick(params.name);
        }
      });
    }
  }
}

export function renderAdsBars(el: HTMLElement, channels: { channel: string; clients: number }[]): void {
  const chart = ensureChart(el, "ads-bars");
  chart.setOption(
    {
      grid: { left: 16, right: 16, top: 16, bottom: 32, containLabel: true },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: channels.map((c) => c.channel),
        axisLabel: { color: "#5a6662", fontSize: 11, rotate: 20 },
      },
      yAxis: { type: "value", axisLabel: { color: "#5a6662" }, splitLine: { lineStyle: { color: "#e6ebe8" } } },
      series: [
        {
          type: "bar",
          data: channels.map((c) => c.clients),
          itemStyle: { color: "#1f6f5b", borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 42,
        },
      ],
    },
    true,
  );
}

export function resizeCharts(): void {
  charts.forEach((chart) => chart.resize());
}
