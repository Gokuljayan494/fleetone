"use client";
import { useState, type ReactNode } from "react";
import type { ZodType } from "zod";
import { fieldErrors } from "@/lib/schemas";

export function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <div>
            <h2>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, error, children, wide }: { label: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`field${error ? " err" : ""}${wide ? " wide" : ""}`}>
      <label>{label}</label>
      {children}
      {error && <div className="msg">{error}</div>}
    </div>
  );
}

/**
 * Client-side zod validation + POST. Returns field errors keyed like the schema,
 * `form` for request-level failures. Server re-validates with the same schema.
 */
export function useZodSubmit<T>(schema: ZodType<T>, url: string) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(raw: unknown, onSuccess: (data: unknown) => void) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.errors ?? { form: "Something went wrong — try again" });
        return;
      }
      onSuccess(body);
    } catch {
      setErrors({ form: "Network error — is the server running?" });
    } finally {
      setBusy(false);
    }
  }

  return { errors, busy, submit, setErrors };
}
