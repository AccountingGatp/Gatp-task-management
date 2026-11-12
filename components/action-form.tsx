"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import type { ActionState } from "@/lib/types";

/** Wraps a server action form: shows errors inline, confirms success with a toast. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, null);
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast(true, state.message);
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
      router.refresh();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state && !state.ok ? (
        <p className="mt-3 text-[0.8125rem] text-brick" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export { SubmitButton } from "@/components/submit-button";
