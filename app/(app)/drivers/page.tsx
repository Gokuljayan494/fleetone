import { Topbar } from "@/components/Topbar";
import { DriversClient } from "@/components/DriversClient";

export default function DriversPage() {
  return (
    <>
      <Topbar title="Drivers" sub="Team register · licenses tracked" />
      <DriversClient />
    </>
  );
}
