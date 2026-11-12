import type { Metadata } from "next";
import clsx from "clsx";
import { Download } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { buildReport, type ReportType } from "@/lib/reports";
import { isISODate, monthLabel, todayISO } from "@/lib/dates";
import { EmptyState, PageHeader, Tabs } from "@/components/ui";
import { MonthNav } from "@/components/week-nav";

export const metadata: Metadata = { title: "Reports" };

const TYPES: { key: ReportType; label: string; blurb: string }[] = [
  { key: "employee", label: "By person", blurb: "Workload, on-time completion and hours split into manual, automation and review." },
  { key: "client", label: "By client", blurb: "Progress and hours for each client. Positive over / under means more time than estimated." },
  { key: "task", label: "By task", blurb: "Where estimates are off. Tasks taking the most extra time are at the top." },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; type?: string }> }) {
  const { supabase } = await requireManager();
  const sp = await searchParams;
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const month = sp.month && isISODate(sp.month + "-01") ? sp.month : thisMonth;
  const type = (TYPES.find((t) => t.key === sp.type)?.key ?? "employee") as ReportType;
  const report = await buildReport(supabase, month, type, today);
  const meta = TYPES.find((t) => t.key === type)!;

  const fmt = (v: unknown, unit?: string) => {
    if (v === null || v === undefined || v === "") return <span className="text-fog">—</span>;
    if (typeof v === "number") return `${v}${unit === "%" ? "%" : unit === "h" ? " h" : ""}`;
    return String(v);
  };

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${monthLabel(month + "-01")}. Tasks due this month and the time logged against them.`}
        actions={
          <>
            <MonthNav basePath="/reports" month={month} thisMonth={thisMonth} params={{ type }} />
            <a href={`/api/reports/export?month=${month}&type=${type}`} className="btn">
              <Download size={14} />
              Export CSV
            </a>
          </>
        }
      />
      <Tabs current={`/reports?month=${month}&type=${type}`} items={TYPES.map((t) => ({ href: `/reports?month=${month}&type=${t.key}`, label: t.label }))} />
      <p className="t-meta mb-4">{meta.blurb}</p>

      {report.rows.length === 0 ? (
        <EmptyState title="No work in this month" body="Pick another month, or press Schedule on the Recurring tasks page." />
      ) : (
        <div className="panel max-h-[72vh] overflow-auto">
          <table className="table">
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <th key={c.key} className={c.numeric ? "r" : undefined}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i}>
                  {report.columns.map((c, j) => {
                    const v = r[c.key];
                    const warn = (c.key === "overdue" && Number(v) > 0) || (c.key === "variance" && Number(v) > 0.5) || (c.key === "utilisation" && Number(v) > 100);
                    return (
                      <td key={c.key} className={clsx(c.numeric && "r", j === 0 && "font-medium whitespace-nowrap", warn && "font-medium text-brick", c.key === "staff" && "text-graphite")}>
                        {fmt(v, c.unit)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-canvas font-semibold">
                {report.columns.map((c) => (
                  <td key={c.key} className={clsx("border-t border-rule px-3 py-2.5", c.numeric && "r")}>
                    {report.totals[c.key] !== undefined ? fmt(report.totals[c.key], c.unit) : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
