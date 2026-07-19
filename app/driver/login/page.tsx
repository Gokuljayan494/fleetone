"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { I } from "@/components/Icons";
import { Field, useZodSubmit } from "@/components/forms";
import { DriverLoginBody } from "@/lib/schemas";

export default function DriverLogin() {
  const router = useRouter();
  const { errors, busy, submit } = useZodSubmit(DriverLoginBody, "/api/auth/login");
  const [form, setForm] = useState({ driverId: "", pin: "" });

  return (
    <div className="auth">
      <div className="auth-card">
        <span className="logo-mark" style={{ width: 40, height: 40, borderRadius: 13 }}><I name="bolt" size={19} /></span>
        <h1>Driver sign-in</h1>
        <div className="sub">Use the ID and PIN your owner gave you</div>
        <form
          style={{ marginTop: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit({ ...form, role: "driver" }, () => router.push("/driver"));
          }}
        >
          <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="Driver ID" error={errors.driverId}>
              <input
                value={form.driverId}
                onChange={(e) => setForm((f) => ({ ...f, driverId: e.target.value.toUpperCase() }))}
                placeholder="SK01"
                autoFocus
                autoCapitalize="characters"
                style={{ fontSize: 16, fontWeight: 700, letterSpacing: ".12em", textAlign: "center" }}
              />
            </Field>
            <Field label="4-digit PIN" error={errors.pin}>
              <div className="pin-input">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                  placeholder="••••"
                />
              </div>
            </Field>
          </div>
          {errors.form && <div className="form-err">{errors.form}</div>}
          <button type="submit" className="btn btn-p full" style={{ marginTop: 16, padding: 12, fontSize: 14 }} disabled={busy}>
            {busy ? "Signing in…" : "Start my day"}
          </button>
        </form>
        <div className="auth-hint">Demo driver — ID <code>SK01</code> · PIN <code>4321</code></div>
        <div className="auth-switch">Fleet owner? <Link href="/login">Owner sign-in →</Link></div>
      </div>
    </div>
  );
}
