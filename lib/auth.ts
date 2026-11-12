import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";
import type { Employee } from "@/lib/types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, employee: null as Employee | null };

  let { data: employee } = await supabase.from("employees").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (!employee) {
    await supabase.rpc("sync_my_employee");
    ({ data: employee } = await supabase.from("employees").select("*").eq("auth_user_id", user.id).maybeSingle());
  }
  return { supabase, user, employee: (employee as Employee | null) ?? null };
});

export async function requireEmployee() {
  const session = await getSession();
  if (!session.user) redirect("/login");
  if (!isEmailAllowed(session.user.email)) redirect("/auth/signout?reason=domain");
  if (!session.employee || !session.employee.active) redirect("/pending");
  return { supabase: session.supabase, user: session.user, me: session.employee };
}

export async function requireManager() {
  const s = await requireEmployee();
  if (s.me.role === "employee") redirect("/my-work");
  return s;
}

export async function requireAdmin() {
  const s = await requireEmployee();
  if (s.me.role !== "admin") redirect("/overview");
  return s;
}

export function isManagerRole(role: string | undefined | null) {
  return role === "admin" || role === "manager";
}
