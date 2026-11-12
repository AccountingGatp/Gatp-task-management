import { NextResponse, type NextRequest } from "next/server";
import { getSession, isManagerRole } from "@/lib/auth";
import { buildReport, type ReportType } from "@/lib/reports";
import { isISODate, todayISO } from "@/lib/dates";
import { csvEscape } from "@/lib/format";

export async function GET(request: NextRequest) {
  const { supabase, employee } = await getSession();
  if (!employee?.active || !isManagerRole(employee.role)) return NextResponse.json({ error: "Managers only" }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  const today = todayISO();
  const month = sp.get("month") && isISODate(sp.get("month") + "-01") ? sp.get("month")! : today.slice(0, 7);
  const type = (["employee", "client", "task"].includes(sp.get("type") ?? "") ? sp.get("type") : "employee") as ReportType;
  const report = await buildReport(supabase, month, type, today);
  const lines = [
    report.columns.map((c) => csvEscape(c.unit ? `${c.label} (${c.unit === "h" ? "hours" : "%"})` : c.label)).join(","),
    ...report.rows.map((r) => report.columns.map((c) => csvEscape(r[c.key])).join(",")),
    report.columns.map((c) => csvEscape(report.totals[c.key] ?? "")).join(","),
  ];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gatp-${type}-report-${month}.csv"`,
    },
  });
}
