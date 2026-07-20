import { Topbar } from "@/components/Topbar";
import { TrackingClient } from "@/components/TrackingClient";

export const dynamic = "force-dynamic";

export default function TrackingPage() {
  return (
    <>
      <Topbar title="Live Tracking" sub="Where every vehicle is right now" />
      <TrackingClient />
    </>
  );
}
