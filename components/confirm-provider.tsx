"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

type Resolver = (value: boolean) => void;

const ConfirmContext = createContext<{
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
} | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  function handle(result: boolean) {
    resolver?.(result);
    setOpts(null);
    setResolver(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-panel p-6 shadow-2xl">
            <h3 className="font-display text-base font-bold text-ink">{opts.title}</h3>
            <p className="mt-2 text-sm text-ink-dim">{opts.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => handle(false)}
                className="rounded-lg border border-border px-3.5 py-2 text-xs font-medium text-ink-dim hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold ${
                  opts.danger
                    ? "bg-danger text-white"
                    : "bg-gradient-to-r from-amber to-cyan text-black"
                }`}
              >
                {opts.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx.confirm;
}
