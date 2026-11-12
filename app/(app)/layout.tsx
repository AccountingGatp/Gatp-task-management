import { cookies } from "next/headers";
import { Sidebar } from "@/components/sidebar";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";
import { requireEmployee } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, me } = await requireEmployee();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  const [{ count: reviewCount }, { count: reworkCount }] = await Promise.all([
    supabase.from("task_assignments").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]).eq("reviewer_id", me.id),
    supabase.from("task_assignments").select("id", { count: "exact", head: true }).eq("assignee_id", me.id).eq("status", "rework"),
  ]);

  return (
    <div className="lg:flex">
      <Sidebar name={me.full_name} role={me.role} avatar={me.avatar_url} reviewCount={reviewCount ?? 0} reworkCount={reworkCount ?? 0} initialCollapsed={collapsed} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-[1376px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}
