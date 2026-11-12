import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { addDays, todayISO } from "@/lib/dates";

// Vercel Cron calls this every morning (see vercel.json) with
// "Authorization: Bearer $CRON_SECRET". It schedules the next 14 days of recurring work.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = todayISO();
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("generate_recurring_assignments", { p_from: today, p_to: addDays(today, 14) });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: data, from: today, to: addDays(today, 14) });
}
