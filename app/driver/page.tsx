import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DriverClient } from "@/components/DriverClient";

export default async function DriverPage() {
  const session = await getSession();
  if (!session || session.role !== "driver") redirect("/driver/login");
  return <DriverClient driverName={session.name} assignedPlate={session.plate} />;
}
