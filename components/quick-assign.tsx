"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { quickAssign } from "@/lib/actions/tasks";
import { useToast } from "@/components/toast";

export function QuickAssign({ taskId, value, people }: { taskId: string; value: string | null; people: { id: string; full_name: string; label?: string }[] }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <select
      className="select h-7 w-auto min-w-[10rem] text-xs"
      aria-label="Assign to"
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const res = await quickAssign(taskId, e.target.value || null);
          if (res) toast(res.ok, res.message);
          router.refresh();
        })
      }
    >
      <option value="">Unassigned</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label ?? p.full_name}
        </option>
      ))}
    </select>
  );
}
