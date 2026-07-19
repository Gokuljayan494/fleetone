import { Topbar } from "@/components/Topbar";
import { VehiclesClient } from "@/components/VehiclesClient";

export default function VehiclesPage() {
  return (
    <>
      <Topbar title="Vehicles" sub="Live fleet register" />
      <VehiclesClient />
    </>
  );
}
