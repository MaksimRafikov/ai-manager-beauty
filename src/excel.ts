import * as XLSX from "xlsx";
import type { CallListRow, PrepayRow } from "./types";
import { trackGoal } from "./metrika";

function sheetFromRows(rows: CallListRow[] | PrepayRow[], title: string): XLSX.WorkSheet {
  const data = rows.map((row) => {
    const r = row as unknown as Record<string, string | number | undefined>;
    return {
      "№": r.no ?? "",
      Клиент: r.client_name ?? "",
      Телефон: r.phone_fmt ?? "",
      Визиты: r.frequency ?? r.appointments_12m ?? "",
      Выручка: r.monetary ?? r.lost_revenue_12m ?? "",
      "Ср. чек": r.avg_check ?? "",
      "Дней с визита": r.recency_days ?? "",
      "Последний визит": r.last_visit ?? "",
      Группа: r.segment ?? "",
      Филиалы: r.branches ?? "",
      "Серия неявок": r.noshow_streak ?? "",
      "Доля неявок": r.noshow_rate_12m ?? "",
    };
  });
  const sheet = XLSX.utils.json_to_sheet(data);
  sheet["!cols"] = Object.keys(data[0] ?? { a: 1 }).map(() => ({ wch: 16 }));
  void title;
  return sheet;
}

export function downloadCallListExcel(
  rows: CallListRow[],
  filename: string,
  sheetName: string,
): void {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheetFromRows(rows, sheetName), sheetName.slice(0, 31));
  XLSX.writeFile(book, filename);
  trackGoal("excel_download", { file: filename });
}

export function downloadPrepayExcel(rows: PrepayRow[], filename: string): void {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheetFromRows(rows, "Предоплата"), "Предоплата");
  XLSX.writeFile(book, filename);
  trackGoal("excel_download", { file: filename });
}
