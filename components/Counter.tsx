"use client";
import { useEffect, useRef } from "react";

export function Counter({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = to.toFixed(decimals);
      return;
    }
    let t0: number | null = null;
    let raf = 0;
    const dur = 1100;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(decimals);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, decimals]);
  return <span ref={ref}>0</span>;
}
