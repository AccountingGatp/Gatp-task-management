"use client";

import { useFormStatus } from "react-dom";
import clsx from "clsx";
import type { ReactNode } from "react";

export function SubmitButton({ children, pendingText, className, variant = "primary" }: { children: ReactNode; pendingText?: string; className?: string; variant?: "primary" | "default" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button className={clsx("btn", variant === "primary" && "btn-primary", variant === "danger" && "btn-danger", className)} disabled={pending}>
      {pending ? pendingText ?? "Saving…" : children}
    </button>
  );
}
