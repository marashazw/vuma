"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

interface ModalState {
  message: string;
  isConfirm: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ModalContextValue {
  alert: (message: string) => Promise<void>;
  confirm: (message: string, opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const alert = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setState({ message, isConfirm: false });
    });
  }, []);

  const confirm = useCallback(
    (message: string, opts?: { confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = (value: boolean) => resolve(value);
        setState({ message, isConfirm: true, ...opts });
      });
    },
    []
  );

  function close(result: boolean) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }

  return (
    <ModalContext.Provider value={{ alert, confirm }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-navy-900/40 backdrop-blur-sm px-4 pb-4 sm:pb-4">
          <div className="card w-full max-w-sm p-5 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              {state.isConfirm && state.danger ? (
                <AlertTriangle className="w-5 h-5 text-coral-500 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-navy-400 shrink-0 mt-0.5" />
              )}
              <p className="text-sm text-navy-700 leading-relaxed">{state.message}</p>
            </div>
            <div className="flex gap-2 justify-end">
              {state.isConfirm && (
                <button className="btn-ghost !py-2 !px-4 text-sm" onClick={() => close(false)}>
                  {state.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                className={`!py-2 !px-4 text-sm ${state.isConfirm && state.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => close(true)}
              >
                {state.isConfirm ? state.confirmLabel || "OK" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

/** Drop-in-ish replacement for native alert()/confirm() — branded, no
 * browser-chrome URL text, and returns a Promise so call sites can `await`
 * it the same way they'd check the return value of confirm(). */
export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within a ModalProvider");
  return ctx;
}
