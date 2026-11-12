import { redirect } from "next/navigation";
import { requireEmployee, isManagerRole } from "@/lib/auth";

export default async function Home() {
  const { me } = await requireEmployee();
  redirect(isManagerRole(me.role) ? "/overview" : "/my-work");
}
