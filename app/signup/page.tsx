"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { I } from "@/components/Icons";
import { Field, useZodSubmit } from "@/components/forms";
import { SignupSchema } from "@/lib/schemas";

/** Any transport company can register here — they get their own empty fleet. */
export default function Signup() {
  const router = useRouter();
  const { errors, busy, submit } = useZodSubmit(SignupSchema, "/api/auth/signup");
  const [form, setForm] = useState({ companyName: "", name: "", email: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="auth">
      <div className="auth-card">
        <span className="logo-mark" style={{ width: 40, height: 40, borderRadius: 13 }}><I name="bolt" size={19} /></span>
        <h1>Start your fleet</h1>
        <div className="sub">Create a company account — free trial</div>
        <form
          style={{ marginTop: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit(form, () => router.push("/"));
          }}
        >
          <div className="fgrid" style={{ gridTemplateColumns: "1fr" }}>
            <Field label="Company name" error={errors.companyName}>
              <input value={form.companyName} onChange={set("companyName")} placeholder="Acme Transport" autoFocus />
            </Field>
            <Field label="Your name" error={errors.name}>
              <input value={form.name} onChange={set("name")} placeholder="Meera Iyer" />
            </Field>
            <Field label="Work email" error={errors.email}>
              <input type="email" value={form.email} onChange={set("email")} placeholder="meera@acme.in" />
            </Field>
            <Field label="Password" error={errors.password}>
              <input type="password" value={form.password} onChange={set("password")} placeholder="At least 6 characters" />
            </Field>
          </div>
          {errors.form && <div className="form-err">{errors.form}</div>}
          <button type="submit" className="btn btn-p full" style={{ marginTop: 16, padding: 11 }} disabled={busy}>
            {busy ? "Creating your fleet…" : "Create company account"}
          </button>
        </form>
        <div className="auth-hint">
          You start with an empty fleet — add your vehicles and drivers, and hand each driver the ID and PIN we generate.
        </div>
        <div className="auth-switch">Already have an account? <Link href="/login">Sign in →</Link></div>
      </div>
    </div>
  );
}
