"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { I } from "@/components/Icons";
import { Field, useZodSubmit } from "@/components/forms";
import { OwnerLoginBody } from "@/lib/schemas";

export default function OwnerLogin() {
  const router = useRouter();
  const { errors, busy, submit } = useZodSubmit(OwnerLoginBody, "/api/auth/login");
  const [form, setForm] = useState({ email: "", password: "" });

  return (
    <div className="auth">
      <div className="auth-card">
        <span className="logo-mark" style={{ width: 40, height: 40, borderRadius: 13 }}><I name="bolt" size={19} /></span>
        <h1>Sign in to FleetOne</h1>
        <div className="sub">Owner &amp; manager access</div>
        <form
          style={{ marginTop: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit({ ...form, role: "owner" }, () => router.push("/"));
          }}
        >
          <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="arjun@fleetone.in" autoFocus />
            </Field>
            <Field label="Password" error={errors.password}>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </Field>
          </div>
          {errors.form && <div className="form-err">{errors.form}</div>}
          <button type="submit" className="btn btn-p full" style={{ marginTop: 16, padding: 11 }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="auth-hint">Demo login — email <code>arjun@fleetone.in</code> · password <code>fleetone123</code></div>
        <div className="auth-switch">New company? <Link href="/signup">Create an account →</Link></div>
        <div className="auth-switch">Driving today? <Link href="/driver/login">Driver sign-in →</Link></div>
      </div>
    </div>
  );
}
