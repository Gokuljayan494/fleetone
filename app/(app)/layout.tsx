import { redirect } from "next/navigation";
import { getSession, STAFF } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Owners and managers use the office app; a signed-in driver belongs in the
  // driver app, not bounced to the login screen.
  if (!session) redirect("/login");
  if (!STAFF.includes(session.role)) redirect("/driver");
  return <AppShell>{children}</AppShell>;
}
