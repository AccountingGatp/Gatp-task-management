"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native <dialog>: focus trapping, Escape and the backdrop come for free. */
export function Dialog({ open, onClose, title, children, description }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="sheet-enter m-auto w-[min(440px,calc(100vw-2rem))] rounded-xl border border-rule bg-paper p-0 text-ink shadow-[var(--shadow-3)] backdrop:bg-ink/25 backdrop:backdrop-blur-[2px]"
    >
      {open ? (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="t-section">{title}</h2>
              {description ? <p className="t-meta mt-1">{description}</p> : null}
            </div>
            <button type="button" className="btn btn-ghost btn-icon -mt-1 -mr-2" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
