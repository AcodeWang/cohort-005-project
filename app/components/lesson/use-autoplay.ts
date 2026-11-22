import { useState, useEffect, useCallback } from "react";

export const AUTOPLAY_KEY = "cadence-autoplay";

export function useAutoplay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTOPLAY_KEY) === "true");
    } catch {
      // Storage can be blocked (private mode, disabled cookies); autoplay then stays off.
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(AUTOPLAY_KEY, String(next));
    } catch {
      // Storage can be blocked; the choice then lasts only for this page.
    }
  }, [enabled]);

  return [enabled, toggle] as const;
}
