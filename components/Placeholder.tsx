import { Topbar } from "@/components/Topbar";
import { I } from "@/components/Icons";

export function Placeholder({ title, icon, blurb }: { title: string; icon: string; blurb: string }) {
  return (
    <>
      <Topbar title={title} sub="Coming soon in this build" />
      <div className="content" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ padding: "40px 48px", textAlign: "center", maxWidth: 420 }}>
          <span
            className="kico"
            style={{ background: "var(--ind-soft)", color: "var(--ind)", width: 44, height: 44, borderRadius: 13, margin: "0 auto 14px", display: "grid" }}
          >
            <I name={icon} size={20} />
          </span>
          <h2 style={{ fontSize: 16, letterSpacing: "-.01em" }}>{title}</h2>
          <p style={{ color: "var(--mut)", fontSize: 12.5, marginTop: 8 }}>{blurb}</p>
          <button className="btn btn-p" style={{ marginTop: 18 }}>Notify me</button>
        </div>
      </div>
    </>
  );
}
