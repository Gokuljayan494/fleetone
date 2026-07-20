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
 * Destructive actions always go through this: a named confirmation, the server's
 * own refusal surfaced verbatim (e.g. "this customer has invoices"), and no
 * optimistic removal until the DELETE actually succeeds.
 */
export function ConfirmDelete({
  title,
  body,
  confirmLabel,
  url,
  onClose,
  onDeleted,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  url: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error ?? "Could not delete — try again");
        return;
      }
      onDeleted();
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p style={{ fontSize: 12.5, color: "var(--mut)", lineHeight: 1.55 }}>{body}</p>
      {error && <div className="form-err">{error}</div>}
      <div className="factions">
        <button type="button" className="btn btn-s" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-d" onClick={run} disabled={busy}>
          {busy ? "Deleting…" : confirmLabel}
        </button>
      </div>
    </Modal>
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
