"use client";
import { useEffect, useState } from "react";

/** The Chrome/Android install event, which isn't in the DOM lib types. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "fleetone.installDismissed";

/**
 * Registers the service worker and offers an "Add to phone" prompt. On Android/
 * Chrome it triggers the native install dialog; on iOS Safari (which has no
 * such API) it shows the manual Share → Add to Home Screen steps.
 */
export function InstallPWA() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works without it */
      });
    }

    // Already installed / launched from the home screen — nothing to prompt.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    setDismissed(false);

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos) setShowIosHint(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — fine */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    close();
  }

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div className="pwa-bar" role="dialog" aria-label="Add FleetOne to your phone">
      <div className="pwa-txt">
        <b>Add FleetOne to your phone</b>
        {deferred ? (
          <span>Install it for one-tap access — no app store needed.</span>
        ) : (
          <span>Tap the Share button, then “Add to Home Screen”.</span>
        )}
      </div>
      {deferred && (
        <button className="btn btn-p" onClick={install}>
          Add
        </button>
      )}
      <button className="pwa-x" onClick={close} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
