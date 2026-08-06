"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, PlusSquare } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed / running standalone — never show anything.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    if (sessionStorage.getItem("vuma-install-dismissed")) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari never fires beforeinstallprompt — detect it directly and
    // show manual "Share → Add to Home Screen" instructions instead.
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isSafari = /safari/.test(window.navigator.userAgent.toLowerCase()) && !/crios|fxios/.test(window.navigator.userAgent.toLowerCase());
    if (isIos && isSafari) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("vuma-install-dismissed", "1");
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  if (dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-5 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-sm z-40">
      <div className="card p-4 bg-navy-800 text-paper flex items-start gap-3 shadow-lg">
        {deferredPrompt ? (
          <>
            <Download className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Install Vuma</p>
              <p className="text-xs text-navy-300 mt-0.5">Add it to your home screen for quick, app-like access.</p>
              <button className="btn-primary !py-1.5 !px-3 text-xs mt-2" onClick={install}>
                Install
              </button>
            </div>
          </>
        ) : (
          <>
            <Share className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Add Vuma to your Home Screen</p>
              <p className="text-xs text-navy-300 mt-0.5 flex items-center gap-1 flex-wrap">
                Tap <Share className="w-3.5 h-3.5 inline" /> Share, then <PlusSquare className="w-3.5 h-3.5 inline" /> "Add to Home
                Screen."
              </p>
            </div>
          </>
        )}
        <button onClick={dismiss} className="text-navy-400 hover:text-navy-200 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
