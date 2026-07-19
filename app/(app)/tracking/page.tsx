import { Topbar } from "@/components/Topbar";
import { I } from "@/components/Icons";
import { Av, Bar, Stars } from "@/components/ui";
import { RealMap } from "@/components/RealMap";

export default function TrackingPage() {
  return (
    <>
      <Topbar
        title="Trip TRP-20871"
        sub="Bengaluru → Chennai · Zenith Logistics"
        actions={
          <>
            <button className="btn btn-s"><I name="phone" />Call driver</button>
            <button className="btn btn-p">Share live link</button>
          </>
        }
      />
      <div className="content" style={{ flexDirection: "row", display: "flex", gap: 14 }}>
        <div className="card" style={{ flex: 1, overflow: "hidden", minHeight: 540, padding: 14 }}>
          <RealMap height={510} focusPlate="KA 05 MJ 2211" zoom={11} />
        </div>

        <div className="col" style={{ width: 300, flexShrink: 0 }}>
          <div className="card" style={{ padding: "15px 16px" }}>
            <div className="row" style={{ gap: 10, marginBottom: 13 }}>
              <Av g="g1" size="md">SK</Av>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 12.5, display: "block" }}>Suresh Kumar</b>
                <span style={{ fontSize: 10.5, color: "var(--mut)" }}>
                  Tata Ace Gold · <span className="plate" style={{ fontSize: 9.5, padding: "1px 6px" }}>KA 05 MJ 2211</span>
                </span>
              </div>
              <span className="rate"><Stars on={5} />4.9</span>
            </div>
            <div className="tline">
              <div className="tstop">
                <span className="knot" /><b>Whitefield Hub, Bengaluru</b>
                <span>Picked up 8 pallets · 09:05 am</span><span className="tm">09:05</span>
              </div>
              <div className="tstop mid">
                <span className="knot" /><b>Hosur checkpoint</b>
                <span>Documents verified</span><span className="tm">10:12</span>
              </div>
              <div className="tstop mid">
                <span className="knot" /><b>Vellore fuel stop</b>
                <span>32 L diesel · ₹2,970</span><span className="tm">12:48</span>
              </div>
              <div className="tstop end">
                <span className="knot" /><b>Ambattur, Chennai</b>
                <span>Drop · Zenith Logistics W-4</span><span className="tm ok">ETA 4:35</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "15px 16px" }}>
            <h3 style={{ fontSize: 12.5, marginBottom: 11 }}>Trip economics</h3>
            <div className="pl-grid">
              <div><b>312 km</b><span>Distance</span></div>
              <div><b>7h 30m</b><span>Duration</span></div>
              <div><b>41.2 L</b><span>Fuel used</span></div>
              <div><b>₹6,180</b><span>Cost</span></div>
              <div><b>₹18,400</b><span>Revenue</span></div>
              <div className="good"><b>₹12,220</b><span>Profit</span></div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--mut)" }}>Margin</span>
              <Bar pct={66} color="var(--emr)" />
              <b style={{ fontSize: 11, color: "var(--emr-ink)" }}>66%</b>
            </div>
          </div>

          <div className="card side-note">
            <I name="warn" />
            <span><b>Heavy traffic on NH44.</b> ETA slipped 12 min — customer notified automatically.</span>
          </div>
        </div>
      </div>
    </>
  );
}
