import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DriverClient } from "@/components/DriverClient";

export default async function DriverPage() {
  const session = await getSession();
  if (!session) redirect("/driver/login");
  // Office staff who wander here go to their own app, not the driver login.
  if (session.role !== "driver") redirect("/");
  return <DriverClient driverName={session.name} assignedPlate={session.plate} />;
}
