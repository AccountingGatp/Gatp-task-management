"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { CircleCheck, CircleAlert } from "lucide-react";

type Toast = { id: number; ok: boolean; message: string };
const Ctx = createContext<(ok: boolean, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((ok: boolean, message: string) => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-2), { id, ok, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ok ? 3200 : 6000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "toast-enter pointer-events-auto flex max-w-md items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[0.8125rem] shadow-[var(--shadow-3)]",
              t.ok ? "border-ink bg-ink text-paper" : "border-coral bg-paper text-brick",
            )}
          >
            {t.ok ? <CircleCheck size={16} className="mt-px shrink-0" /> : <CircleAlert size={16} className="mt-px shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
