import { Topbar } from "@/components/Topbar";
import { FuelClient } from "@/components/FuelClient";

export default function FuelPage() {
  return (
    <>
      <Topbar title="Fuel" sub="Fill-up logs · km/L analytics · anomaly flags" />
      <FuelClient />
    </>
  );
}
