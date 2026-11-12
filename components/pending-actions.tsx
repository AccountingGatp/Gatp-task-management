"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePending } from "@/lib/actions/admin";
import { useToast } from "@/components/toast";

export function PendingActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const go = (approve: boolean) =>
    start(async () => {
      const res = await approvePending(id, approve);
      if (res) toast(res.ok, res.message);
      router.refresh();
    });
  return (
    <div className="flex gap-1.5">
      <button className="btn btn-sm" disabled={pending} onClick={() => go(false)}>Remove</button>
      <button className="btn btn-sm btn-primary" disabled={pending} onClick={() => go(true)}>Give access</button>
    </div>
  );
}
