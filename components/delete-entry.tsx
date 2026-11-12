"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTimeEntry } from "@/lib/actions/tasks";
import { useToast } from "@/components/toast";

export function DeleteEntryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-sm btn-icon text-fog hover:text-brick"
      aria-label="Remove entry"
      title="Remove entry"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteTimeEntry(id);
          if (res) toast(res.ok, res.message);
          router.refresh();
        })
      }
    >
      <Trash2 size={14} />
    </button>
  );
}
